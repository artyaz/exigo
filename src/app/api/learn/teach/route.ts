import { auth } from "@clerk/nextjs/server";
import { GoogleGenAI } from "@google/genai";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { renderPrompt } from "../../../../../convex/coursePrompts";
import { ConvexAuthError, createAuthedConvexClient } from "../../../../lib/convexClientAuth";
import {
  captureAiGenerationEvent,
  createAiTraceId,
} from "../../../../../shared/posthogAiObservability";
import {
  createRequestId,
  getErrorAttributes,
  logError,
  logInfo,
} from "../../../../lib/otlpLogger";

export const runtime = "nodejs";
export const maxDuration = 60;

function getAiClient() {
  if (!process.env.GOOGLE_GEMINI_API_KEY) throw new Error("GOOGLE_GEMINI_API_KEY not set");
  return new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });
}

function getModel() {
  return process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
}

export async function POST(req: Request) {
  const requestId = createRequestId(req.headers);
  const startedAt = Date.now();

  const { userId, getToken } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const body = (await req.json()) as { lessonId: string; userMessage?: string };
  const { lessonId, userMessage } = body;

  if (!lessonId) {
    return new Response(JSON.stringify({ error: "lessonId required" }), { status: 400 });
  }

  let convex: Awaited<ReturnType<typeof createAuthedConvexClient>>;
  try {
    convex = await createAuthedConvexClient(getToken, "api.learn.teach");
  } catch (error) {
    logError("Failed to initialize Convex client for teach", {
      source: "api.learn.teach",
      requestId,
      route: "/api/learn/teach",
      userId,
      duration_ms: Date.now() - startedAt,
      ...getErrorAttributes(error),
    });
    if (error instanceof ConvexAuthError) {
      return new Response(JSON.stringify({ error: "Unauthorized: Missing Convex auth token." }), { status: 401 });
    }
    const msg = error instanceof Error ? error.message : "Unauthorized";
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }

  try {
    const lessonIdTyped = lessonId as Id<"courseLessons">;

    const lesson = await convex.query(api.courseLessons.get, { lessonId: lessonIdTyped });
    if (!lesson) throw new Error("Lesson not found");

    const courseId = lesson.courseId as Id<"courses">;
    const course = await convex.query(api.courses.get, { courseId });
    if (!course) throw new Error("Course not found");

    // Save user message if provided
    if (userMessage) {
      await convex.mutation(api.courseLessonMessages.send, {
        courseId,
        lessonId: lessonIdTyped,
        content: userMessage,
        role: "user",
      });
    }

    // Get conversation history
    const messages = await convex.query(api.courseLessonMessages.getForLesson, { lessonId: lessonIdTyped });

    // Safety: cap teacher messages per lesson to prevent infinite generation loops
    const MAX_TEACHER_MESSAGES = 15;
    const teacherMessageCount = messages.filter((m: { role: string }) => m.role === "teacher").length;
    if (teacherMessageCount >= MAX_TEACHER_MESSAGES) {
      const encoder = new TextEncoder();
      const forceComplete = new ReadableStream({
        start(controller) {
          const text = "[LESSON_COMPLETE]";
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "delta", text })}\n\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", isComplete: true, inputRequest: null, fullText: text })}\n\n`));
          controller.close();
        },
      });
      return new Response(forceComplete, {
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
      });
    }

    let masteryGoals: string[] = [];
    try {
      masteryGoals = lesson.masteryGoals ? JSON.parse(lesson.masteryGoals) : [];
    } catch { /* empty */ }

    const historyStr = messages
      .slice(-20)
      .map((m: { role: string; content: string }) =>
        `${m.role === "teacher" ? "Teacher" : m.role === "user" ? "Student" : "System"}: ${m.content}`,
      )
      .join("\n");

    const hasHistory = historyStr && historyStr !== "This is the beginning of the lesson.";
    const promptName = hasHistory ? "teacher_continue" : "teacher_start";
    const promptDoc = await convex.query(api.coursePrompts.getPrompt, { name: promptName });

    let prompt: string;
    if (hasHistory) {
      prompt = renderPrompt(promptDoc.content, {
        topic: course.refinedTitle,
        subTopic: lesson.title,
        context: historyStr,
      });
    } else {
      prompt = renderPrompt(promptDoc.content, {
        topic: course.refinedTitle,
        subTopic: lesson.title,
        masteryArray: JSON.stringify(masteryGoals),
      });
    }

    const ai = getAiClient();
    const model = getModel();
    const encoder = new TextEncoder();
    const aiTraceId = createAiTraceId();

    logInfo("Teach stream started", {
      source: "api.learn.teach",
      requestId,
      route: "/api/learn/teach",
      userId,
      ai_provider: "google",
      ai_model: model,
      lessonId,
    });

    const readable = new ReadableStream({
      async start(controller) {
        try {
          const requestStartedAt = Date.now();
          const stream = await ai.models.generateContentStream({ model, contents: prompt });
          let fullText = "";
          let firstTokenAt: number | undefined;
          let lastChunk: unknown;

          for await (const chunk of stream) {
            lastChunk = chunk;
            const part = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
            if (part) {
              firstTokenAt ??= Date.now();
              fullText += part;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "delta", text: part })}\n\n`),
              );
            }
          }

          captureAiGenerationEvent({
            distinctId: userId,
            traceId: aiTraceId,
            provider: "google",
            model,
            input: [{ role: "user", content: prompt }],
            response: lastChunk,
            outputChoices: [{ role: "assistant", content: fullText }],
            latencySeconds: (Date.now() - requestStartedAt) / 1000,
            stream: true,
            timeToFirstTokenSeconds: firstTokenAt
              ? (firstTokenAt - requestStartedAt) / 1000
              : undefined,
          });

          logInfo("Teach stream generation succeeded", {
            source: "api.learn.teach",
            requestId,
            route: "/api/learn/teach",
            userId,
            ai_provider: "google",
            ai_model: model,
            duration_ms: Date.now() - requestStartedAt,
            lessonId,
          });

          // Parse completed response
          const isComplete = fullText.includes("[LESSON_COMPLETE]");
          const inputRequestMatch = fullText.match(
            /\[INPUT_REQUEST:\s*([^|\]]+?)\s*\|\s*([^|\]]+?)\s*(?:\|\s*([^\]]*?))?\s*\]/,
          );

          const messageType = inputRequestMatch ? "input_request" : isComplete ? "lesson_complete" : "narrative";

          // Save teacher message to DB
          await convex.mutation(api.courseLessonMessages.send, {
            courseId,
            lessonId: lessonIdTyped,
            content: fullText,
            role: "teacher",
            messageType,
          });

          // Send done event with parsed metadata
          const donePayload = {
            type: "done" as const,
            isComplete,
            inputRequest: inputRequestMatch
              ? {
                type: inputRequestMatch[1]!.trim(),
                question: inputRequestMatch[2]!.trim(),
                expectedAnswer: inputRequestMatch[3]?.trim() ?? "",
              }
              : null,
            fullText,
          };

          controller.enqueue(encoder.encode(`data: ${JSON.stringify(donePayload)}\n\n`));
          controller.close();
        } catch (err) {
          logError("Teach stream failed", {
            source: "api.learn.teach",
            requestId,
            route: "/api/learn/teach",
            userId,
            duration_ms: Date.now() - startedAt,
            ...getErrorAttributes(err),
          });
          const msg = err instanceof Error ? err.message : "Unknown error";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", error: msg })}\n\n`),
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    logError("Teach request failed", {
      source: "api.learn.teach",
      requestId,
      route: "/api/learn/teach",
      userId,
      duration_ms: Date.now() - startedAt,
      ...getErrorAttributes(err),
    });
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
}
