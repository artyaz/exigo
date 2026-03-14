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
  const { userId, getToken } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
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
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
    });
  }

  let convex: Awaited<ReturnType<typeof createAuthedConvexClient>>;
  try {
    convex = await createAuthedConvexClient(getToken, "api.learn.clarify");
  } catch (error) {
    if (error instanceof ConvexAuthError) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });
    }
    const msg = error instanceof Error ? error.message : "Unauthorized";
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
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
      courseId,
      lessonId: lessonIdTyped,
      role: "user",
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
    const encoder = new TextEncoder();
    const aiTraceId = createAiTraceId();

    // Use TransformStream for proper streaming with explicit flush per chunk
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    // Fire-and-forget the streaming generation
    (async () => {
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
            await writer.write(
              encoder.encode(
                `data: ${JSON.stringify({ type: "delta", text: part })}\n\n`,
              ),
            );
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
        await convex.mutation(api.courseLessonMessages.send, {
          courseId,
          lessonId: lessonIdTyped,
          role: "teacher",
          content: fullText,
          messageType: "clarification",
          clarificationQuote: quote,
          threadId,
        });

        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({ type: "done", fullText })}\n\n`,
          ),
        );
        await writer.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        try {
          await writer.write(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", error: msg })}\n\n`,
            ),
          );
          await writer.close();
        } catch {
          // Writer may already be closed
        }
      }
    })();

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
}
