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
import {
  CURRENT_MODULE_INSERT_PLACEMENTS,
  type CurrentModuleInsertionPlacement,
} from "../../../../../shared/currentModuleInsertion";
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

function getOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function getRequiredStringArg(
  args: Record<string, unknown>,
  key: string,
  label: string,
): string {
  const value = getOptionalString(args[key]);
  if (!value) {
    throw new Error(`${label} is required.`);
  }
  return value;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function getOptionalInsertPlacement(
  value: unknown,
): CurrentModuleInsertionPlacement | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  return CURRENT_MODULE_INSERT_PLACEMENTS.includes(
    value as CurrentModuleInsertionPlacement,
  )
    ? (value as CurrentModuleInsertionPlacement)
    : undefined;
}

function getCourseKnowledgePieceSource(courseId: Id<"courses">): string {
  return `adaptive-course:${courseId}`;
}

async function getOrCreateCourseKnowledgePieceId(
  convex: ConvexHttpClient,
  spaceId: Id<"spaces">,
  courseId: Id<"courses">,
): Promise<Id<"knowledgePieces">> {
  const knowledgePieces = await convex.query(api.knowledgePieces.getForSpace, {
    spaceId,
  });
  const coursePiece = knowledgePieces.find(
    (piece: { source?: string }) =>
      piece.source === getCourseKnowledgePieceSource(courseId),
  );
  if (coursePiece) {
    return coursePiece._id;
  }

  const fallbackPiece = knowledgePieces[0];
  if (fallbackPiece) {
    return fallbackPiece._id;
  }

  const course = await convex.query(api.courses.get, { courseId });
  if (!course) {
    throw new Error("Course not found.");
  }

  return await convex.mutation(api.knowledgePieces.add, {
    spaceId,
    title: `${course.refinedTitle} notes`,
    content: `Tutor-managed curriculum notes for ${course.refinedTitle}.`,
    source: getCourseKnowledgePieceSource(courseId),
  });
}

async function addCourseKnowledgeNode(params: {
  convex: ConvexHttpClient;
  spaceId: Id<"spaces">;
  courseId: Id<"courses">;
  type: "struggle" | "improvement" | "feels_hard";
  content: string;
}) {
  const knowledgePieceId = await getOrCreateCourseKnowledgePieceId(
    params.convex,
    params.spaceId,
    params.courseId,
  );

  await params.convex.mutation(api.knowledgeNodes.create, {
    spaceId: params.spaceId,
    knowledgePieceId,
    type: params.type,
    content: params.content,
  });
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
      "Insert a specific topic into the current active module as a lesson, placing it where it best fits in the remaining lesson sequence. Use when the student explicitly asks to add a topic to the module they are currently working through.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        topic: {
          type: Type.STRING,
          description: "The topic to insert into the curriculum",
        },
        context: {
          type: Type.STRING,
          description: "Why this topic should be added and how it connects to the current module",
        },
        focusArea: {
          type: Type.STRING,
          description: "A concise focus area description for the inserted lesson",
        },
        placement: {
          type: Type.STRING,
          description:
            "Where to place the topic in the current module. Use one of: after_current_lesson, before_lesson, after_lesson, end_of_module",
        },
        referenceLessonTitle: {
          type: Type.STRING,
          description:
            "When placement is before_lesson or after_lesson, give the exact lesson title to place this topic relative to",
        },
        targetsWeakness: {
          type: Type.BOOLEAN,
          description:
            "Set true when the inserted lesson is primarily remediating a weakness or confusion",
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

      try {
        const topic = getRequiredStringArg(args, "topic", "A lesson topic");
        const reason = getOptionalString(args.reason) ?? "Student interest";

        await addCourseKnowledgeNode({
          convex,
          spaceId,
          courseId,
          type: "feels_hard",
          content: `Student requested lesson on: ${topic}. Reason: ${reason}`,
        });

        return {
          success: true,
          message: `Noted! I've flagged "${topic}" as a topic you want covered. The adaptive curriculum will prioritize this in upcoming module generation.`,
        };
      } catch (error) {
        return {
          success: false,
          message: getErrorMessage(
            error,
            "Failed to register the lesson request.",
          ),
        };
      }
    }

    case "suggest_curriculum_change": {
      if (!courseId) {
        return {
          success: false,
          message: "No active course to modify curriculum for.",
        };
      }

      try {
        const suggestion = getRequiredStringArg(
          args,
          "suggestion",
          "A curriculum suggestion",
        );

        await addCourseKnowledgeNode({
          convex,
          spaceId,
          courseId,
          type: "struggle",
          content: `Curriculum feedback: ${suggestion}`,
        });

        return {
          success: true,
          message: `Curriculum feedback recorded: "${suggestion}". The adaptive system will consider this when generating the next module.`,
        };
      } catch (error) {
        return {
          success: false,
          message: getErrorMessage(
            error,
            "Failed to record curriculum suggestion.",
          ),
        };
      }
    }

    case "insert_topic": {
      if (!courseId) {
        return {
          success: false,
          message: "No active course — need a course context to insert a topic.",
        };
      }

      try {
        const topic = getRequiredStringArg(args, "topic", "A topic");
        const context = getOptionalString(args.context) ?? "Student request";
        const focusArea = getOptionalString(args.focusArea) ?? context;
        const placement = getOptionalInsertPlacement(args.placement);
        const referenceLessonTitle = getOptionalString(args.referenceLessonTitle);
        const targetsWeakness = args.targetsWeakness === true;

        const result = await convex.mutation(
          api.courseLessons.insertIntoCurrentModule,
          {
            courseId,
            title: topic,
            focusArea,
            placement,
            referenceLessonTitle: referenceLessonTitle ?? undefined,
            targetsWeakness,
          },
        );

        await addCourseKnowledgeNode({
          convex,
          spaceId,
          courseId,
          type: "improvement",
          content: `Tutor inserted "${topic}" into the current module "${result.moduleTitle}" ${result.placementSummary}. Context: ${context}`,
        });

        return {
          success: true,
          message: `Inserted "${topic}" into the current module ${result.placementSummary}.`,
        };
      } catch (error) {
        return {
          success: false,
          message: getErrorMessage(error, "Failed to insert topic."),
        };
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
  let currentModuleContext = "No active module context";
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

      const currentModule = modules?.find(
        (m: { moduleIndex: number; _id: string; moduleTitle: string }) =>
          m.moduleIndex === course.currentModuleIndex,
      );
      if (currentModule) {
        const currentModuleLessons = (lessons ?? [])
          .filter(
            (lesson: { moduleId: string }) => lesson.moduleId === currentModule._id,
          )
          .sort(
            (
              left: { lessonIndex: number },
              right: { lessonIndex: number },
            ) => left.lessonIndex - right.lessonIndex,
          );
        const currentLesson =
          currentModuleLessons[course.currentLessonIndex] ?? null;

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

        currentModuleContext = [
          `Current module: ${currentModule.moduleTitle}`,
          `Current module lesson sequence:`,
          ...currentModuleLessons.map(
            (
              lesson: { title: string; status: string },
              index: number,
            ) =>
              `- ${index + 1}. ${lesson.title} [${lesson.status}]${
                index === course.currentLessonIndex
                  ? " (current)"
                  : index < course.currentLessonIndex
                    ? " (already passed)"
                    : ""
              }`,
          ),
        ].join("\n");
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
    currentModuleContext,
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
        const ai = getAiClient();
        const ctx = await assembleContext(
          convex,
          spaceId,
          effectiveCourseId,
          ai,
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

        const model = getModel();
        const startedAt = Date.now();

        // ─── Generate with Tool Support ───
        // First call: non-streaming to check for function calls
        const toolConfig = effectiveCourseId
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

          await convex.mutation(api.courseTutor.sendTutorMessage, {
            chatId,
            content: fullResponse,
            serverSecret: process.env.EXIGO_SERVER_MUTATION_SECRET ?? "",
          });

          send("done", { chatId });
        } else {
          // No tool calls — reuse the already-generated response
          const fullResponse = initialResponse.text ?? "";
          if (fullResponse) {
            send("delta", { text: fullResponse });
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

          await convex.mutation(api.courseTutor.sendTutorMessage, {
            chatId,
            content: fullResponse,
            serverSecret: process.env.EXIGO_SERVER_MUTATION_SECRET ?? "",
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
                sourceCourseId: effectiveCourseId ?? undefined,
                embedding,
              });
            }
          }
        } catch {
          // Memory extraction is best-effort
        }

        controller.close();
      } catch {
        send("error", { error: "Tutor request failed" });
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
