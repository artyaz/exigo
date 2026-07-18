import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { jsonError, requireAuthedApi } from "../../../../lib/apiAuth";
import { resolveAiProvider } from "../../../../server/ai";
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
import { renderPrompt } from "../../../../../convex/coursePrompts";

interface FeelsHardBody {
  testId?: string;
  questionId?: string;
  messageContent?: string;
  knowledgePieceId?: string;
}

function parseBody(raw: Record<string, unknown>): FeelsHardBody {
  return {
    testId: raw.testId as string | undefined,
    questionId: raw.questionId as string | undefined,
    messageContent: raw.messageContent as string | undefined,
    knowledgePieceId: raw.knowledgePieceId as string | undefined,
  };
}

function resolveTargetPiece(
  knowledgePieceId: string | undefined,
  testKnowledgePieceId: Id<"knowledgePieces"> | undefined,
): Id<"knowledgePieces"> | null {
  if (knowledgePieceId) {
    return knowledgePieceId as Id<"knowledgePieces">;
  }
  if (testKnowledgePieceId) {
    return testKnowledgePieceId;
  }
  return null;
}

/**
 * "Feels hard" endpoint: takes a chat message + question context, uses AI to
 * generate a concise struggle note ("User had an issue with ..."), then appends
 * that note to the knowledge piece that was used for this test.
 */
export async function POST(req: NextRequest) {
  const requestId = createRequestId(req.headers);
  const startedAt = Date.now();
  try {
    const authResult = await requireAuthedApi("api.tests.feels-hard", {
      requestId,
      route: "/api/tests/feels-hard",
      duration_ms: Date.now() - startedAt,
    });
    if (authResult instanceof Response) return authResult;
    const { userId, convex } = authResult;

    const planStatus = await convex.query(api.planLimits.getPlan, {});

    if (!planStatus.features.conversational_ai) {
      return NextResponse.json(
        { error: "Upgrade to Pro to use Deep Dive study notes!" },
        { status: 403 },
      );
    }

    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Server missing Gemini API key" },
        { status: 500 },
      );
    }

    const { testId, questionId, messageContent, knowledgePieceId } = parseBody(
      (await req.json()) as Record<string, unknown>,
    );
    if (!testId || !questionId || !messageContent) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const test = await convex.query(api.tests.get, {
      testId: testId as Id<"tests">,
    });
    if (!test) {
      return NextResponse.json({ error: "Test not found" }, { status: 404 });
    }

    const space = await convex.query(api.spaces.get, {
      spaceId: test.spaceId,
    });
    if (!space) {
      return NextResponse.json(
        { error: "Unauthorized access or space not found" },
        { status: 403 },
      );
    }

    const question = await convex.query(api.questions.get, {
      questionId: questionId as Id<"questions">,
    });
    if (!question) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 },
      );
    }
    if (String(question.testId) !== testId) {
      return NextResponse.json(
        { error: "Question does not belong to this test" },
        { status: 400 },
      );
    }

    const targetPieceId = resolveTargetPiece(
      knowledgePieceId,
      test.knowledgePieceId,
    );
    if (!targetPieceId) {
      return NextResponse.json(
        { error: "Missing knowledgePieceId for this test context." },
        { status: 400 },
      );
    }

    const pastMessages = await convex.query(api.testMessages.getForQuestion, {
      questionId: questionId as Id<"questions">,
      userId,
    });
    const conversationContext =
      pastMessages
        .map(
          (m) => `${m.role === "user" ? "Student" : "AI Tutor"}: ${m.content}`,
        )
        .join("\n") || "No prior conversation.";

    const provider = await resolveAiProvider(convex);
    const promptDoc = await convex.query(api.coursePrompts.getPrompt, {
      name: "feels_hard_note",
    });
    const prompt = renderPrompt(promptDoc.content, {
      questionText: question.question,
      questionAnswer: question.answer ?? "N/A",
      userAnswer: question.userAnswer ?? "N/A",
      messageContent,
      conversationContext,
    });

    const aiTraceId = createAiTraceId();
    const model = provider.config.model;
    const aiStartedAt = Date.now();
    logInfo("Feels-hard AI generation started", {
      source: "api.tests.feels-hard",
      requestId,
      route: "/api/tests/feels-hard",
      userId,
      testId,
      questionId,
      ai_provider: provider.config.label,
      ai_model: model,
    });
    const result = await provider.generate({ prompt, model });
    captureAiGenerationEvent({
      distinctId: userId,
      traceId: aiTraceId,
      provider: provider.config.label,
      model,
      input: [{ role: "user", content: prompt }],
      response: result.raw,
      latencySeconds: (Date.now() - aiStartedAt) / 1000,
    });
    logInfo("Feels-hard AI generation succeeded", {
      source: "api.tests.feels-hard",
      requestId,
      route: "/api/tests/feels-hard",
      userId,
      testId,
      questionId,
      ai_provider: provider.config.label,
      ai_model: model,
      duration_ms: Date.now() - aiStartedAt,
    });
    const struggleNote =
      result.text?.trim() ?? "User had an issue with this topic.";

    await convex.mutation(api.knowledgeNodes.create, {
      spaceId: test.spaceId,
      knowledgePieceId: targetPieceId,
      type: "feels_hard",
      content: struggleNote,
    });

    await convex.mutation(api.deepDives.create, {
      spaceId: test.spaceId,
      questionId: questionId as Id<"questions">,
    });

    return NextResponse.json({ success: true, note: struggleNote });
  } catch (err: unknown) {
    logError("Feels-hard request failed", {
      source: "api.tests.feels-hard",
      requestId,
      route: "/api/tests/feels-hard",
      duration_ms: Date.now() - startedAt,
      ...getErrorAttributes(err),
    });
    return jsonError(500, "Internal server error");
  }
}
