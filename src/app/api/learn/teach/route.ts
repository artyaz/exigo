import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { renderPrompt } from "../../../../../convex/coursePrompts";
import { jsonError, requireAuthedApi } from "../../../../lib/apiAuth";
import { requireServerMutationSecret } from "../../../../lib/serverMutationSecret";
import { getEnvGeminiClient, getEnvGeminiModel } from "../../../../server/ai/geminiEnv";
import {
  enqueueSseError,
  sseData,
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
  logInfo,
} from "../../../../lib/otlpLogger";

export const runtime = "nodejs";
export const maxDuration = 60;

function parseMasteryGoals(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}



export async function POST(req: Request) {
  const requestId = createRequestId(req.headers);
  const startedAt = Date.now();

  const authResult = await requireAuthedApi("api.learn.teach", {
    requestId,
    route: "/api/learn/teach",
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

  const body = (await req.json()) as { lessonId: string; userMessage?: string };
  const { lessonId, userMessage } = body;

  if (!lessonId) {
    return jsonError(400, "lessonId required");
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

    // Save user message if provided
    if (userMessage) {
      await convex.mutation(api.courseLessonMessages.send, {
        lessonId: lessonIdTyped,
        content: userMessage,
      });
    }

    // Get conversation history
    const messages = await convex.query(api.courseLessonMessages.getForLesson, {
      lessonId: lessonIdTyped,
    });

    // Safety: cap teacher messages per lesson to prevent infinite generation loops
    const MAX_TEACHER_MESSAGES = 15;
    const teacherMessageCount = messages.filter(
      (m: { role: string }) => m.role === "teacher",
    ).length;
    if (teacherMessageCount >= MAX_TEACHER_MESSAGES) {
      const forceComplete = new ReadableStream({
        start(controller) {
          const text = "[LESSON_COMPLETE]";
          controller.enqueue(sseDelta(text));
          controller.enqueue(
            sseDone({
              isComplete: true,
              inputRequest: null,
              fullText: text,
            }),
          );
          controller.close();
        },
      });
      return sseResponse(forceComplete);
    }

    const masteryGoals = parseMasteryGoals(lesson.masteryGoals);

    const historyStr = messages
      .slice(-20)
      .map(
        (m: { role: string; content: string }) =>
          `${m.role === "teacher" ? "Teacher" : m.role === "user" ? "Student" : "System"}: ${m.content}`,
      )
      .join("\n");

    const hasHistory =
      historyStr && historyStr !== "This is the beginning of the lesson.";
    const promptName = hasHistory ? "teacher_continue" : "teacher_start";
    const promptDoc = await convex.query(api.coursePrompts.getPrompt, {
      name: promptName,
    });

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

    const ai = getEnvGeminiClient();
    const model = getEnvGeminiModel();
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
          const stream = await ai.models.generateContentStream({
            model,
            contents: prompt,
          });
          let fullText = "";
          let firstTokenAt: number | undefined;
          let lastChunk: unknown;

          for await (const chunk of stream) {
            lastChunk = chunk;
            const part = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
            if (part) {
              firstTokenAt ??= Date.now();
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
          const inputRequestMatch =
            /\[INPUT_REQUEST:\s*([^|\]]+?)\s*\|\s*([^|\]]+?)\s*(?:\|\s*([^\]]*?))?\s*\]/.exec(
              fullText,
            );

          const messageType = inputRequestMatch
            ? "input_request"
            : isComplete
              ? "lesson_complete"
              : "narrative";

          // Save teacher message to DB
          await convex.mutation(api.courseLessonMessages.sendTeacher, {
            serverSecret,
            lessonId: lessonIdTyped,
            content: fullText,
            messageType,
          });

          // Send done event with parsed metadata
          controller.enqueue(
            sseData({
              type: "done",
              isComplete,
              inputRequest: inputRequestMatch
                ? {
                    type: inputRequestMatch[1]!.trim(),
                    question: inputRequestMatch[2]!.trim(),
                    expectedAnswer: inputRequestMatch[3]?.trim() ?? "",
                  }
                : null,
              fullText,
            }),
          );
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
          enqueueSseError(controller, "Teaching failed");
        }
      },
    });

    return sseResponse(readable);
  } catch (err) {
    logError("Teach request failed", {
      source: "api.learn.teach",
      requestId,
      route: "/api/learn/teach",
      userId,
      duration_ms: Date.now() - startedAt,
      ...getErrorAttributes(err),
    });
    return jsonError(500, "Teaching request failed");
  }
}
