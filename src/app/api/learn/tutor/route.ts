import { auth } from "@clerk/nextjs/server";
import { GoogleGenAI } from "@google/genai";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { renderPrompt } from "../../../../../convex/coursePrompts";
import {
  ConvexAuthError,
  createAuthedConvexClient,
} from "../../../../lib/convexClientAuth";
import {
  captureAiGenerationEvent,
  createAiTraceId,
} from "../../../../../shared/posthogAiObservability";

export const runtime = "nodejs";
export const maxDuration = 60;

function getAiClient() {
  if (!process.env.GOOGLE_GEMINI_API_KEY)
    throw new Error("GOOGLE_GEMINI_API_KEY not set");
  return new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });
}

function getModel() {
  return process.env.GEMINI_MODEL ?? "gemini-3-flash-preview";
}

async function generateEmbedding(
  ai: GoogleGenAI,
  text: string,
): Promise<number[]> {
  const result = await ai.models.embedContent({
    model: "text-embedding-004",
    contents: text,
  });
  return result.embeddings?.[0]?.values ?? [];
}

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: Request) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  let convex;
  try {
    convex = await createAuthedConvexClient(
      getToken,
      "api.learn.tutor",
    );
  } catch (e) {
    if (e instanceof ConvexAuthError) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 401,
      });
    }
    throw e;
  }

  const body = (await req.json()) as {
    courseId: string;
    chatId?: string;
    message: string;
  };

  if (!body.courseId || !body.message?.trim()) {
    return new Response(JSON.stringify({ error: "Missing courseId or message" }), {
      status: 400,
    });
  }

  const courseId = body.courseId as Id<"courses">;
  const userMessage = body.message.trim();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sseEvent(event, data)));
      };

      try {
        // Get or create chat
        let chatId: Id<"courseTutorChats">;
        if (body.chatId) {
          chatId = body.chatId as Id<"courseTutorChats">;
        } else {
          const title = userMessage.slice(0, 60) + (userMessage.length > 60 ? "..." : "");
          chatId = await convex.mutation(api.courseTutor.createChat, {
            courseId,
            title,
          });
          send("chat_created", { chatId });
        }

        // Save user message
        await convex.mutation(api.courseTutor.sendMessage, {
          chatId,
          role: "user",
          content: userMessage,
        });

        // ─── Assemble Context ───

        // L0: Course structure
        const course = await convex.query(api.courses.get, { courseId });
        if (!course) {
          send("error", { error: "Course not found" });
          controller.close();
          return;
        }

        const modules = await convex.query(api.courseModules.getForCourse, { courseId });
        const lessons = await convex.query(api.courseLessons.getForCourse, { courseId });
        const knowledgeNodes = await convex.query(api.knowledgeNodes.getActiveForSpace, {
          spaceId: course.spaceId,
        });

        // L0: Recent chat history
        const chatHistory = await convex.query(api.courseTutor.getMessages, { chatId });
        const recentHistory = chatHistory.slice(-20);

        // L1: Semantic memory search
        const ai = getAiClient();
        let relevantMemories: Array<{ content: string; category: string; _score?: number }> = [];
        try {
          const queryEmbedding = await generateEmbedding(ai, userMessage);
          if (queryEmbedding.length > 0) {
            const memories = await convex.query(api.courseTutor.getMemoriesForSpace, {
              spaceId: course.spaceId,
            });
            // Client-side cosine similarity since we can't call internalQuery from HTTP client
            relevantMemories = memories
              .filter((m: { embedding: number[] }) => m.embedding && m.embedding.length > 0)
              .map((m: { embedding: number[]; content: string; category: string }) => {
                const dotProduct = m.embedding.reduce(
                  (sum: number, val: number, i: number) => sum + val * (queryEmbedding[i] ?? 0),
                  0,
                );
                const magA = Math.sqrt(
                  m.embedding.reduce((sum: number, val: number) => sum + val * val, 0),
                );
                const magB = Math.sqrt(
                  queryEmbedding.reduce((sum: number, val: number) => sum + val * val, 0),
                );
                const score = magA && magB ? dotProduct / (magA * magB) : 0;
                return { content: m.content, category: m.category, _score: score };
              })
              .sort((a: { _score?: number }, b: { _score?: number }) => (b._score ?? 0) - (a._score ?? 0))
              .slice(0, 5);
          }
        } catch {
          // Embedding search failed — continue without memories
        }

        // Build course context string
        const courseContext = [
          `Course: ${course.refinedTitle}`,
          `Description: ${course.courseDescription}`,
          `Phase: ${course.phase}`,
          `Modules: ${modules?.map((m: { moduleIndex: number; moduleTitle: string }) => `${m.moduleIndex + 1}. ${m.moduleTitle}`).join("; ") ?? "none"}`,
          `Lessons completed: ${lessons?.filter((l: { status: string }) => ["summarized", "integrated"].includes(l.status)).length ?? 0}/${lessons?.length ?? 0}`,
        ].join("\n");

        // Build current lesson context
        const currentLesson = lessons?.find(
          (l: { lessonIndex: number }) => l.lessonIndex === course.currentLessonIndex,
        );
        const currentLessonContext = currentLesson
          ? [
              `Title: ${currentLesson.title}`,
              `Focus: ${currentLesson.focusArea}`,
              `Status: ${currentLesson.status}`,
              currentLesson.summaryMarkdown
                ? `Summary: ${currentLesson.summaryMarkdown.slice(0, 500)}`
                : "",
            ]
              .filter(Boolean)
              .join("\n")
          : "No active lesson";

        // Build knowledge nodes string
        const activeNodes = (knowledgeNodes ?? []).filter(
          (n: { isActive: boolean }) => n.isActive,
        );
        const nodesContext =
          activeNodes.length > 0
            ? activeNodes
                .map(
                  (n: { type: string; content: string }) =>
                    `[${n.type.toUpperCase()}] ${n.content}`,
                )
                .join("\n")
            : "No active knowledge nodes yet";

        // Build memories string
        const memoriesContext =
          relevantMemories.length > 0
            ? relevantMemories
                .map((m) => `[${m.category.toUpperCase()}] ${m.content}`)
                .join("\n")
            : "No memories yet — this is a new conversation";

        // Build chat history string
        const historyContext =
          recentHistory.length > 0
            ? recentHistory
                .map((m: { role: string; content: string }) => `${m.role === "user" ? "Student" : "Tutor"}: ${m.content}`)
                .join("\n")
            : "No previous messages";

        // ─── Generate Response ───
        const promptDoc = await convex.query(api.coursePrompts.getPrompt, {
          name: "course_tutor",
        });

        if (!promptDoc) {
          send("error", { error: "Tutor prompt not found. Run seed prompts." });
          controller.close();
          return;
        }

        const prompt = renderPrompt(promptDoc.content, {
          courseContext,
          knowledgeNodes: nodesContext,
          relevantMemories: memoriesContext,
          currentLessonContext,
          chatHistory: historyContext,
          userMessage,
        });

        const model = getModel();
        const startedAt = Date.now();
        const response = await ai.models.generateContentStream({
          model,
          contents: prompt,
        });

        let fullResponse = "";
        for await (const chunk of response) {
          const text = chunk.text ?? "";
          if (text) {
            fullResponse += text;
            send("delta", { text });
          }
        }

        captureAiGenerationEvent({
          distinctId: userId,
          traceId: createAiTraceId(),
          provider: "google",
          model,
          input: [{ role: "user", content: prompt }],
          response: { text: fullResponse },
          latencySeconds: (Date.now() - startedAt) / 1000,
        });

        // Save tutor response
        await convex.mutation(api.courseTutor.sendMessage, {
          chatId,
          role: "tutor",
          content: fullResponse,
        });

        send("done", { chatId });

        // ─── Background: Extract Memories ───
        try {
          const memoryPromptDoc = await convex.query(api.coursePrompts.getPrompt, {
            name: "tutor_memory_extract",
          });

          if (memoryPromptDoc) {
            const existingMemories = relevantMemories
              .map((m) => m.content)
              .join("\n");

            const memoryPrompt = renderPrompt(memoryPromptDoc.content, {
              courseName: course.refinedTitle,
              userMessage,
              tutorResponse: fullResponse,
              existingMemories: existingMemories || "None",
            });

            const memoryResponse = await ai.models.generateContent({
              model,
              contents: memoryPrompt,
            });

            const memoryText = memoryResponse.text?.trim() ?? "[]";
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
              const embedding = await generateEmbedding(ai, mem.content);
              if (embedding.length === 0) continue;

              await convex.mutation(api.courseTutor.addMemory, {
                spaceId: course.spaceId,
                content: mem.content,
                category: mem.category,
                sourceType: "tutor_chat" as const,
                sourceCourseId: courseId,
                embedding,
              });
            }
          }
        } catch {
          // Memory extraction is best-effort
        }

        controller.close();
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Unknown error";
        send("error", { error: msg });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
