import { FunctionCallingConfigMode } from "@google/genai";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { renderPrompt } from "../../../../../convex/coursePrompts";
import { jsonError, requireAuthedApi } from "../../../../lib/apiAuth";
import { requireServerMutationSecret } from "../../../../lib/serverMutationSecret";
import { resolveAiProvider } from "../../../../server/ai";
import { sseData, sseResponse, enqueueSseError } from "../../../../lib/sse";
import { createRequestId, getErrorAttributes, logError } from "../../../../lib/otlpLogger";
import {
  captureAiGenerationEvent,
  createAiTraceId,
} from "../../../../../shared/posthogAiObservability";
import { assembleContext } from "./assembleTutorContext";
import {
  executeTool,
  generateEmbedding,
  getEmbeddingClient,
  tutorToolDeclarations,
} from "./tutorTools";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const authResult = await requireAuthedApi("api.learn.tutor");
  if (authResult instanceof Response) return authResult;
  const { userId, convex } = authResult;

  let serverSecret: string;
  try {
    serverSecret = requireServerMutationSecret();
  } catch {
    return jsonError(503, "Server mutation secret is not configured");
  }

  const body = (await req.json()) as {
    spaceId: string;
    courseId?: string;
    chatId?: string;
    message: string;
  };

  if (!body.spaceId || !body.message?.trim()) {
    return jsonError(400, "Missing spaceId or message");
  }

  const spaceId = body.spaceId as Id<"spaces">;
  const courseId = body.courseId ? (body.courseId as Id<"courses">) : null;
  const userMessage = body.message.trim();

  // Majority type-in-JSON dialect (F-W7-010 / P11-B) — same as teach/clarify
  const stream = new ReadableStream({
    async start(controller) {
      const send = (type: string, data: Record<string, unknown> = {}) => {
        controller.enqueue(sseData({ type, ...data }));
      };

      try {
        // Get or create chat
        let chatId: Id<"courseTutorChats">;
        let effectiveCourseId = courseId;
        if (body.chatId) {
          chatId = body.chatId as Id<"courseTutorChats">;
          if (!effectiveCourseId) {
            const chat = await convex.query(api.courseTutor.getChat, { chatId });
            effectiveCourseId = chat?.courseId ?? null;
          }
        } else {
          const title = userMessage.slice(0, 60) + (userMessage.length > 60 ? "..." : "");
          chatId = await convex.mutation(api.courseTutor.createChat, {
            spaceId,
            courseId: effectiveCourseId ?? undefined,
            title,
          });
          send("chat_created", { chatId });
        }

        // Save user message
        await convex.mutation(api.courseTutor.sendMessage, {
          chatId,
          content: userMessage,
        });

        // ─── Assemble Context ───
        const provider = await resolveAiProvider(convex);
        const embeddingClient = getEmbeddingClient();
        const ctx = await assembleContext(
          convex,
          spaceId,
          effectiveCourseId,
          embeddingClient,
          userMessage,
        );

        // Chat history
        const chatHistory = await convex.query(api.courseTutor.getMessages, { chatId });
        const recentHistory = chatHistory.slice(-20);
        const historyContext =
          recentHistory.length > 0
            ? recentHistory
                .map((m: { role: string; content: string }) =>
                  `${m.role === "user" ? "Student" : "Tutor"}: ${m.content}`,
                )
                .join("\n")
            : "No previous messages";

        // ─── Build Prompt ───
        const promptDoc = await convex.query(api.coursePrompts.getPrompt, {
          name: "course_tutor",
        });

        if (!promptDoc) {
          send("error", { error: "Tutor prompt not found. Run seed prompts." });
          controller.close();
          return;
        }

        const renderedPrompt = renderPrompt(promptDoc.content, {
          courseContext: ctx.courseContext,
          knowledgeNodes: ctx.nodesContext,
          relevantMemories: ctx.memoriesContext,
          currentLessonContext: ctx.currentLessonContext,
          chatHistory: historyContext,
          userMessage,
        });
        const prompt = [
          renderedPrompt,
          "",
          "Tool guidance:",
          "- `insert_topic` inserts a lesson into the current active module, not a future module.",
          "- When you use `insert_topic`, choose a placement anywhere within the current module lesson sequence wherever the topic best fits.",
          `Current module sequencing context:\n${ctx.currentModuleContext}`,
        ].join("\n");

        const model = provider.config.model;
        const startedAt = Date.now();

        // ─── Generate with Tool Support ───
        // First call: non-streaming to check for function calls
        const toolConfig = effectiveCourseId
          ? {
              tools: [{ functionDeclarations: tutorToolDeclarations }],
              toolConfig: {
                functionCallingConfig: { mode: "AUTO" },
              },
            }
          : {};

        const initialResult = await provider.generate({
          prompt,
          ...toolConfig,
        });

        const geminiRaw = initialResult.raw as {
          functionCalls?: Array<{ name?: string; args?: Record<string, unknown> }>;
        } | undefined;
        const functionCalls = geminiRaw?.functionCalls;

        if (functionCalls && functionCalls.length > 0) {
          // Execute tools and build response
          const toolResults: string[] = [];
          for (const [index, call] of functionCalls.entries()) {
            if (!call.name) continue;
            const args = call.args ?? {};
            const toolCallId = `${call.name}-${index}`;
            send("tool_call", { id: toolCallId, name: call.name, args });

            const result = await executeTool(
              call.name,
              args,
              convex,
              spaceId,
              effectiveCourseId,
            );
            toolResults.push(
              result.success
                ? `✅ **${call.name}**: ${result.message}`
                : `❌ **${call.name}**: ${result.message}`,
            );
            send("tool_result", {
              id: toolCallId,
              name: call.name,
              ...result,
            });
          }

          // Generate follow-up response with tool results
          const followUpPrompt = [
            prompt,
            "\n\n---\nTool execution results:",
            ...toolResults,
            "\nNow respond to the student naturally, incorporating the tool results. Be concise.",
          ].join("\n");

          let fullResponse = "";
          for await (const chunk of provider.stream({ prompt: followUpPrompt })) {
            if (chunk.text) {
              fullResponse += chunk.text;
              send("delta", { text: chunk.text });
            }
          }

          captureAiGenerationEvent({
            distinctId: userId,
            traceId: createAiTraceId(),
            provider: provider.config.label,
            model,
            input: [{ role: "user", content: prompt }],
            response: initialResult.raw,
            latencySeconds: (Date.now() - startedAt) / 1000,
          });

          await convex.mutation(api.courseTutor.sendTutorMessage, {
            chatId,
            content: fullResponse,
            serverSecret,
          });

          send("done", { chatId });
        } else {
          // No tool calls — reuse the already-generated response
          const fullResponse = initialResult.text;
          if (fullResponse) {
            send("delta", { text: fullResponse });
          }

          captureAiGenerationEvent({
            distinctId: userId,
            traceId: createAiTraceId(),
            provider: provider.config.label,
            model,
            input: [{ role: "user", content: prompt }],
            response: initialResult.raw,
            latencySeconds: (Date.now() - startedAt) / 1000,
          });

          await convex.mutation(api.courseTutor.sendTutorMessage, {
            chatId,
            content: fullResponse,
            serverSecret,
          });

          send("done", { chatId });
        }

        // ─── Background: Extract Memories ───
        try {
          const memoryPromptDoc = await convex.query(api.coursePrompts.getPrompt, {
            name: "tutor_memory_extract",
          });

          if (memoryPromptDoc) {
            const existingMemories = ctx.relevantMemories
              .map((m) => m.content)
              .join("\n");

            const lastTutorMsg = (
              await convex.query(api.courseTutor.getMessages, { chatId })
            )
              .filter((m: { role: string }) => m.role === "tutor")
              .pop();

            const memoryPrompt = renderPrompt(memoryPromptDoc.content, {
              courseName: ctx.courseName,
              userMessage,
              tutorResponse: lastTutorMsg?.content ?? "",
              existingMemories: existingMemories || "None",
            });

            const memoryResult = await provider.generate({ prompt: memoryPrompt });

            const memoryText = memoryResult.text.trim() || "[]";
            let memories: Array<{
              category: "preference" | "struggle" | "insight" | "goal";
              content: string;
            }> = [];

            try {
              let cleaned = memoryText.trim();
              cleaned = cleaned
                .replace(/^```(?:json)?\s*/i, "")
                .replace(/\s*```$/i, "")
                .trim();
              memories = JSON.parse(cleaned) as typeof memories;
            } catch {
              // Failed to parse memories — skip
            }

            for (const mem of memories) {
              if (!mem.content?.trim()) continue;
              const embedding = await generateEmbedding(embeddingClient, mem.content);
              if (embedding.length === 0) continue;

              await convex.mutation(api.courseTutor.addMemory, {
                spaceId,
                content: mem.content,
                category: mem.category,
                sourceType: "tutor_chat" as const,
                sourceCourseId: effectiveCourseId ?? undefined,
                embedding,
              });
            }
          }
        } catch {
          // Memory extraction is best-effort
        }

        controller.close();
      } catch (err) {
        const requestId = createRequestId();
        logError("Tutor request failed", {
          source: "api.learn.tutor",
          requestId,
          userId,
          spaceId: String(spaceId),
          ...getErrorAttributes(err),
        });
        enqueueSseError(controller, "Tutor request failed");
      }
    },
  });

  return sseResponse(stream);
}
