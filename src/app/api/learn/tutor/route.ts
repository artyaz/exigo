import { auth } from "@clerk/nextjs/server";
import { GoogleGenAI, Type, FunctionCallingConfigMode } from "@google/genai";
import type { FunctionDeclaration } from "@google/genai";
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
import type { ConvexHttpClient } from "convex/browser";

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

// ─── Tool Declarations for Gemini Function Calling ───

const tutorToolDeclarations: FunctionDeclaration[] = [
  {
    name: "request_lesson",
    description:
      "Request a new lesson on a specific topic within the current course. Use when the student wants to learn about a topic not yet covered, or wants a deeper dive into something.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        topic: {
          type: Type.STRING,
          description: "The topic the student wants a lesson on",
        },
        reason: {
          type: Type.STRING,
          description: "Why this lesson would be helpful (brief)",
        },
      },
      required: ["topic"],
    },
  },
  {
    name: "suggest_curriculum_change",
    description:
      "Suggest a change to the course curriculum — reorder modules, adjust focus, skip or add topics. Use when the student expresses concern about the curriculum direction.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        suggestion: {
          type: Type.STRING,
          description: "What change to make to the curriculum",
        },
        urgency: {
          type: Type.STRING,
          description: "How urgent: 'low', 'medium', or 'high'",
        },
      },
      required: ["suggestion"],
    },
  },
  {
    name: "insert_topic",
    description:
      "Insert a specific topic into the course curriculum as the next module. Use when the student explicitly asks to add a topic to their learning path.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        topic: {
          type: Type.STRING,
          description: "The topic to insert into the curriculum",
        },
        context: {
          type: Type.STRING,
          description: "Why this topic should be added and where it fits",
        },
      },
      required: ["topic"],
    },
  },
];

// ─── Tool Execution ───

interface ToolResult {
  success: boolean;
  message: string;
}

async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  convex: ConvexHttpClient,
  spaceId: Id<"spaces">,
  courseId: Id<"courses"> | null,
): Promise<ToolResult> {
  switch (toolName) {
    case "request_lesson": {
      if (!courseId) {
        return {
          success: false,
          message: "No active course — the student needs to start or select a course first.",
        };
      }
      const topic = String(args.topic ?? "");
      // Store as a curriculum suggestion on the course
      try {
        // Create a "feels hard" style node to signal interest in this topic
        const knowledgePieces = await convex.query(
          api.knowledgePieces.getForSpace,
          { spaceId },
        );
        // Find a piece linked to this course, or use first available
        const coursePiece = knowledgePieces.find(
          (p: { source?: string }) =>
            p.source?.includes(courseId),
        );
        if (coursePiece) {
          await convex.mutation(api.knowledgeNodes.create, {
            spaceId,
            knowledgePieceId: coursePiece._id,
            type: "feels_hard",
            content: `Student requested lesson on: ${topic}. Reason: ${String(args.reason ?? "Student interest")}`,
          });
        }
        return {
          success: true,
          message: `Noted! I've flagged "${topic}" as a topic you want covered. The adaptive curriculum will prioritize this in upcoming module generation.`,
        };
      } catch {
        return { success: false, message: "Failed to register the lesson request." };
      }
    }

    case "suggest_curriculum_change": {
      if (!courseId) {
        return {
          success: false,
          message: "No active course to modify curriculum for.",
        };
      }
      const suggestion = String(args.suggestion ?? "");
      try {
        const knowledgePieces = await convex.query(
          api.knowledgePieces.getForSpace,
          { spaceId },
        );
        const coursePiece = knowledgePieces.find(
          (p: { source?: string }) =>
            p.source?.includes(courseId),
        );
        if (coursePiece) {
          await convex.mutation(api.knowledgeNodes.create, {
            spaceId,
            knowledgePieceId: coursePiece._id,
            type: "struggle",
            content: `Curriculum feedback: ${suggestion}`,
          });
        }
        return {
          success: true,
          message: `Curriculum feedback recorded: "${suggestion}". The adaptive system will consider this when generating the next module.`,
        };
      } catch {
        return { success: false, message: "Failed to record curriculum suggestion." };
      }
    }

    case "insert_topic": {
      if (!courseId) {
        return {
          success: false,
          message: "No active course — need a course context to insert a topic.",
        };
      }
      const topic = String(args.topic ?? "");
      try {
        const knowledgePieces = await convex.query(
          api.knowledgePieces.getForSpace,
          { spaceId },
        );
        const coursePiece = knowledgePieces.find(
          (p: { source?: string }) =>
            p.source?.includes(courseId),
        );
        if (coursePiece) {
          await convex.mutation(api.knowledgeNodes.create, {
            spaceId,
            knowledgePieceId: coursePiece._id,
            type: "feels_hard",
            content: `INSERT TOPIC REQUEST: "${topic}". Context: ${String(args.context ?? "Student request")}. This should be the next module topic.`,
          });
        }
        return {
          success: true,
          message: `Topic "${topic}" has been queued for insertion. It will be prioritized in the next module generation cycle.`,
        };
      } catch {
        return { success: false, message: "Failed to insert topic." };
      }
    }

    default:
      return { success: false, message: `Unknown tool: ${toolName}` };
  }
}

// ─── Context Assembly ───

async function assembleContext(
  convex: ConvexHttpClient,
  spaceId: Id<"spaces">,
  courseId: Id<"courses"> | null,
  ai: GoogleGenAI,
  userMessage: string,
) {
  // Knowledge nodes — always space-level
  const knowledgeNodes = await convex.query(api.knowledgeNodes.getActiveForSpace, {
    spaceId,
  });

  const activeNodes = (knowledgeNodes ?? []).filter(
    (n: { isActive: boolean }) => n.isActive,
  );
  const nodesContext =
    activeNodes.length > 0
      ? activeNodes
          .map((n: { type: string; content: string }) => `[${n.type.toUpperCase()}] ${n.content}`)
          .join("\n")
      : "No active knowledge nodes yet";

  // Semantic memory search
  let relevantMemories: Array<{ content: string; category: string; _score?: number }> = [];
  try {
    const queryEmbedding = await generateEmbedding(ai, userMessage);
    if (queryEmbedding.length > 0) {
      const memories = await convex.query(api.courseTutor.getMemoriesForSpace, { spaceId });
      relevantMemories = memories
        .filter((m: { embedding: number[] }) => m.embedding && m.embedding.length > 0)
        .map((m: { embedding: number[]; content: string; category: string }) => {
          const dotProduct = m.embedding.reduce(
            (sum: number, val: number, i: number) => sum + val * (queryEmbedding[i] ?? 0),
            0,
          );
          const magA = Math.sqrt(m.embedding.reduce((sum: number, val: number) => sum + val * val, 0));
          const magB = Math.sqrt(queryEmbedding.reduce((sum: number, val: number) => sum + val * val, 0));
          const score = magA && magB ? dotProduct / (magA * magB) : 0;
          return { content: m.content, category: m.category, _score: score };
        })
        .sort((a: { _score?: number }, b: { _score?: number }) => (b._score ?? 0) - (a._score ?? 0))
        .slice(0, 5);
    }
  } catch {
    // Embedding search failed — continue without memories
  }

  const memoriesContext =
    relevantMemories.length > 0
      ? relevantMemories.map((m) => `[${m.category.toUpperCase()}] ${m.content}`).join("\n")
      : "No memories yet — this is a new conversation";

  // Course-specific context (if courseId provided)
  let courseContext = "No specific course context — space-level conversation";
  let currentLessonContext = "No active lesson";
  let courseName = "General";

  if (courseId) {
    const course = await convex.query(api.courses.get, { courseId });
    if (course) {
      courseName = course.refinedTitle;
      const modules = await convex.query(api.courseModules.getForCourse, { courseId });
      const lessons = await convex.query(api.courseLessons.getForCourse, { courseId });

      courseContext = [
        `Course: ${course.refinedTitle}`,
        `Description: ${course.courseDescription}`,
        `Phase: ${course.phase}`,
        `Modules: ${modules?.map((m: { moduleIndex: number; moduleTitle: string }) => `${m.moduleIndex + 1}. ${m.moduleTitle}`).join("; ") ?? "none"}`,
        `Lessons completed: ${lessons?.filter((l: { status: string }) => ["summarized", "integrated"].includes(l.status)).length ?? 0}/${lessons?.length ?? 0}`,
      ].join("\n");

      const currentLesson = lessons?.find(
        (l: { lessonIndex: number }) => l.lessonIndex === course.currentLessonIndex,
      );
      if (currentLesson) {
        currentLessonContext = [
          `Title: ${currentLesson.title}`,
          `Focus: ${currentLesson.focusArea}`,
          `Status: ${currentLesson.status}`,
          currentLesson.summaryMarkdown
            ? `Summary: ${currentLesson.summaryMarkdown.slice(0, 500)}`
            : "",
        ]
          .filter(Boolean)
          .join("\n");
      }
    }
  } else {
    // Space-level: list all courses for broader context
    const courses = await convex.query(api.courses.getForSpace, { spaceId });
    if (courses && courses.length > 0) {
      courseContext = [
        "Courses in this space:",
        ...courses.map(
          (c: { refinedTitle: string; phase: string }) => `- ${c.refinedTitle} (${c.phase})`,
        ),
      ].join("\n");
    }
  }

  return {
    courseContext,
    currentLessonContext,
    nodesContext,
    memoriesContext,
    relevantMemories,
    courseName,
  };
}

export async function POST(req: Request) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  let convex: ConvexHttpClient;
  try {
    convex = await createAuthedConvexClient(getToken, "api.learn.tutor");
  } catch (e) {
    if (e instanceof ConvexAuthError) {
      return new Response(JSON.stringify({ error: e.message }), { status: 401 });
    }
    throw e;
  }

  const body = (await req.json()) as {
    spaceId: string;
    courseId?: string;
    chatId?: string;
    message: string;
  };

  if (!body.spaceId || !body.message?.trim()) {
    return new Response(JSON.stringify({ error: "Missing spaceId or message" }), {
      status: 400,
    });
  }

  const spaceId = body.spaceId as Id<"spaces">;
  const courseId = body.courseId ? (body.courseId as Id<"courses">) : null;
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
            spaceId,
            courseId: courseId ?? undefined,
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
        const ai = getAiClient();
        const ctx = await assembleContext(convex, spaceId, courseId, ai, userMessage);

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

        const prompt = renderPrompt(promptDoc.content, {
          courseContext: ctx.courseContext,
          knowledgeNodes: ctx.nodesContext,
          relevantMemories: ctx.memoriesContext,
          currentLessonContext: ctx.currentLessonContext,
          chatHistory: historyContext,
          userMessage,
        });

        const model = getModel();
        const startedAt = Date.now();

        // ─── Generate with Tool Support ───
        // First call: non-streaming to check for function calls
        const toolConfig = courseId
          ? {
              tools: [{ functionDeclarations: tutorToolDeclarations }],
              toolConfig: {
                functionCallingConfig: {
                  mode: FunctionCallingConfigMode.AUTO,
                },
              },
            }
          : {};

        const initialResponse = await ai.models.generateContent({
          model,
          contents: prompt,
          config: toolConfig,
        });

        const functionCalls = initialResponse.functionCalls;

        if (functionCalls && functionCalls.length > 0) {
          // Execute tools and build response
          const toolResults: string[] = [];
          for (const call of functionCalls) {
            if (!call.name) continue;
            const args = (call.args ?? {}) as Record<string, unknown>;
            send("tool_call", { name: call.name, args });

            const result = await executeTool(call.name, args, convex, spaceId, courseId);
            toolResults.push(
              result.success
                ? `✅ **${call.name}**: ${result.message}`
                : `❌ **${call.name}**: ${result.message}`,
            );
            send("tool_result", { name: call.name, ...result });
          }

          // Generate follow-up response with tool results
          const followUpPrompt = [
            prompt,
            "\n\n---\nTool execution results:",
            ...toolResults,
            "\nNow respond to the student naturally, incorporating the tool results. Be concise.",
          ].join("\n");

          const followUpResponse = await ai.models.generateContentStream({
            model,
            contents: followUpPrompt,
          });

          let fullResponse = "";
          for await (const chunk of followUpResponse) {
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

          await convex.mutation(api.courseTutor.sendMessage, {
            chatId,
            role: "tutor",
            content: fullResponse,
          });

          send("done", { chatId });
        } else {
          // No tool calls — stream text response directly
          // Re-generate with streaming for better UX
          const streamResponse = await ai.models.generateContentStream({
            model,
            contents: prompt,
            config: toolConfig,
          });

          let fullResponse = "";
          for await (const chunk of streamResponse) {
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

          await convex.mutation(api.courseTutor.sendMessage, {
            chatId,
            role: "tutor",
            content: fullResponse,
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
                spaceId,
                content: mem.content,
                category: mem.category,
                sourceType: "tutor_chat" as const,
                sourceCourseId: courseId ?? undefined,
                embedding,
              });
            }
          }
        } catch {
          // Memory extraction is best-effort
        }

        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
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
