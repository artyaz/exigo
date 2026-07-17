import { GoogleGenAI } from "@google/genai";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { renderPrompt } from "../../../../../convex/coursePrompts";
import { jsonError, requireAuthedApi } from "../../../../lib/apiAuth";
import { requireServerMutationSecret } from "../../../../lib/serverMutationSecret";
import {
  enqueueSseError,
  sseDelta,
  sseDone,
  sseResponse,
} from "../../../../lib/sse";
import {
  captureAiGenerationEvent,
  createAiTraceId,
} from "../../../../../shared/posthogAiObservability";
import {
  createRequestId,
  getErrorAttributes,
  logError,
} from "../../../../lib/otlpLogger";

export const runtime = "nodejs";
export const maxDuration = 30;

function getAiClient() {
  if (!process.env.GOOGLE_GEMINI_API_KEY)
    throw new Error("GOOGLE_GEMINI_API_KEY not set");
  return new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });
}

function getModel() {
  return process.env.GEMINI_MODEL ?? "gemini-3-flash-preview";
}

export async function POST(req: Request) {
  const requestId = createRequestId(req.headers);
  const startedAt = Date.now();

  const authResult = await requireAuthedApi("api.learn.clarify", {
    requestId,
    route: "/api/learn/clarify",
    duration_ms: Date.now() - startedAt,
  });
  if (authResult instanceof Response) return authResult;
  const { userId, convex } = authResult;

  let serverSecret: string;
  try {
    serverSecret = requireServerMutationSecret();
  } catch {
    return jsonError(503, "Server mutation secret is not configured");
  }

  const body = (await req.json()) as {
    lessonId: string;
    quote: string;
    question: string;
    threadId: string;
    blockIndex: number;
    sectionIndex: number;
    lessonContext?: string;
  };

  const {
    lessonId,
    quote,
    question,
    threadId,
    blockIndex,
    sectionIndex,
    lessonContext,
  } = body;
  if (
    !lessonId ||
    !quote ||
    !question ||
    !threadId ||
    typeof blockIndex !== "number" ||
    typeof sectionIndex !== "number"
  ) {
    return jsonError(400, "Missing required fields");
  }

  try {
    const lessonIdTyped = lessonId as Id<"courseLessons">;
    const lesson = await convex.query(api.courseLessons.get, {
      lessonId: lessonIdTyped,
    });
    if (!lesson) throw new Error("Lesson not found");

    const courseId = lesson.courseId as Id<"courses">;
    const course = await convex.query(api.courses.get, { courseId });
    if (!course) throw new Error("Course not found");

    // Save user question
    await convex.mutation(api.courseLessonMessages.send, {
      lessonId: lessonIdTyped,
      content: question,
      messageType: "clarification",
      clarificationQuote: quote,
      threadId,
      clarificationBlockIndex: blockIndex,
      clarificationSectionIndex: sectionIndex,
    });

    // Get thread history
    const allMessages = await convex.query(
      api.courseLessonMessages.getForLesson,
      {
        lessonId: lessonIdTyped,
      },
    );
    const threadMessages = allMessages.filter((m) => m.threadId === threadId);
    const historyStr = threadMessages
      .slice(-10)
      .map(
        (m) =>
          `${m.role === "teacher" || m.role === "system" ? "AI" : "Student"}: ${m.content}`,
      )
      .join("\n");

    // Build prompt with full context
    const promptDoc = await convex.query(api.coursePrompts.getPrompt, {
      name: "clarifier",
    });
    const fullLessonContext = lessonContext
      ? `${course.refinedTitle} > ${lesson.title}\n\nFull lesson text:\n${lessonContext}`
      : `${course.refinedTitle} > ${lesson.title} (Focus: ${lesson.focusArea})`;

    const prompt = renderPrompt(promptDoc.content, {
      lessonContext: fullLessonContext,
      quote,
      question,
      history: historyStr || "No previous conversation in this thread.",
    });

    const ai = getAiClient();
    const model = getModel();
    const aiTraceId = createAiTraceId();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          const requestStartedAt = Date.now();
          const stream = await ai.models.generateContentStream({
            model,
            contents: prompt,
          });
          let fullText = "";

          for await (const chunk of stream) {
            const part = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
            if (part) {
              fullText += part;
              controller.enqueue(sseDelta(part));
            }
          }

          captureAiGenerationEvent({
            distinctId: userId,
            traceId: aiTraceId,
            provider: "google",
            model,
            input: [{ role: "user", content: prompt }],
            response: undefined,
            outputChoices: [{ role: "assistant", content: fullText }],
            latencySeconds: (Date.now() - requestStartedAt) / 1000,
            stream: true,
          });

          // Save AI response
          await convex.mutation(api.courseLessonMessages.sendTeacher, {
            serverSecret,
            lessonId: lessonIdTyped,
            content: fullText,
            messageType: "clarification",
            clarificationQuote: quote,
            threadId,
          });

          controller.enqueue(sseDone({ fullText }));
          controller.close();
        } catch (err) {
          logError("Clarify stream failed", {
            source: "api.learn.clarify",
            requestId,
            route: "/api/learn/clarify",
            userId,
            duration_ms: Date.now() - startedAt,
            ...getErrorAttributes(err),
          });
          enqueueSseError(controller, "Clarification failed");
        }
      },
    });

    return sseResponse(readable);
  } catch (err) {
    logError("Clarify request failed", {
      source: "api.learn.clarify",
      requestId,
      route: "/api/learn/clarify",
      userId,
      duration_ms: Date.now() - startedAt,
      ...getErrorAttributes(err),
    });
    return jsonError(500, "Clarification request failed");
  }
}
