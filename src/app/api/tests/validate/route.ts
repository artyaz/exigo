import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { jsonError, requireAuthedApi } from "../../../../lib/apiAuth";
import { PLAN_LIMIT_CODE } from "../../../../../shared/planConfig";
import {
  captureAiGenerationEvent,
  createAiTraceId,
} from "../../../../../shared/posthogAiObservability";
import {
  createRequestId,
  getErrorAttributes,
  logError,
  logInfo,
  logWarn,
} from "../../../../lib/otlpLogger";
import { renderPrompt } from "../../../../../convex/coursePrompts";

/**
 * Helper to securely validate incoming AI evaluation shape
 */
function validateAIResponse(
  result: unknown,
): { isCorrect: boolean; feedback: string } | null {
  if (
    typeof result === "object" &&
    result !== null &&
    "isCorrect" in result &&
    typeof (result as Record<string, unknown>).isCorrect === "boolean" &&
    "feedback" in result &&
    typeof (result as Record<string, unknown>).feedback === "string"
  ) {
    return {
      isCorrect: (result as Record<string, unknown>).isCorrect as boolean,
      feedback: (result as Record<string, unknown>).feedback as string,
    };
  }
  return null;
}

function resolveTargetPieceId(
  explicitKnowledgePieceId: string | undefined,
  testKnowledgePieceId: Id<"knowledgePieces"> | undefined,
): Id<"knowledgePieces"> | null {
  if (explicitKnowledgePieceId) {
    return explicitKnowledgePieceId as Id<"knowledgePieces">;
  }
  if (testKnowledgePieceId) {
    return testKnowledgePieceId;
  }
  return null;
}

function hasPlanLimitCode(error: unknown, code: string): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const err = error as { data?: { code?: string }; name?: string };
  return err.data?.code === code || err.name === code;
}

export async function POST(req: NextRequest) {
  const requestId = createRequestId(req.headers);
  const startedAt = Date.now();
  try {
    const authResult = await requireAuthedApi("api.tests.validate", {
      requestId,
      route: "/api/tests/validate",
      duration_ms: Date.now() - startedAt,
    });
    if (authResult instanceof Response) return authResult;
    const { userId, convex } = authResult;

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return jsonError(400, "Malformed JSON");
    }

    if (
      rawBody === null ||
      typeof rawBody !== "object" ||
      Array.isArray(rawBody)
    ) {
      return jsonError(400, "Malformed JSON");
    }

    const body = rawBody as Record<string, unknown>;
    const questionId = body.questionId;
    const answer = body.answer;
    const testType = body.testType;
    const knowledgePieceId = body.knowledgePieceId;

    if (
      typeof questionId !== "string" ||
      typeof answer !== "string" ||
      typeof testType !== "string"
    ) {
      return jsonError(400, "Missing or invalid required fields");
    }

    if (
      knowledgePieceId !== undefined &&
      typeof knowledgePieceId !== "string"
    ) {
      return jsonError(400, "Invalid knowledgePieceId");
    }

    if (testType !== "select" && testType !== "write") {
      return jsonError(400, "Invalid testType — must be 'select' or 'write'");
    }

    // Validate active question directly
    const question = await convex.query(api.questions.get, {
      questionId: questionId as Id<"questions">,
    });
    if (!question) return jsonError(404, "Question not found");

    // Verify ownership via space
    const test = await convex.query(api.tests.get, { testId: question.testId });
    if (!test) return jsonError(404, "Test not found");

    const space = await convex.query(api.spaces.get, {
      spaceId: test.spaceId,
      userId,
    });
    if (!space) {
      return jsonError(403, "Unauthorized access or space not found");
    }

    let modelUsedResult: string | undefined;
    let isCorrect = false;
    let aiFeedback = "Correct!";
    const aiTraceId = createAiTraceId();

    if (testType === "select") {
      isCorrect = answer === question.answer;
      aiFeedback = isCorrect
        ? "Correct answer!"
        : `Incorrect. The correct answer was: ${question.answer}`;
    } else if (testType === "write") {
      const planStatus = await convex.query(api.planLimits.getPlan, {});
      if (planStatus.tier !== "educator") {
        return jsonError(
          403,
          "AI feedback for written answers is available on Educator plan. Please upgrade your plan.",
        );
      }

      if (!process.env.GOOGLE_GEMINI_API_KEY) {
        return jsonError(500, "Server missing Gemini API key");
      }
      const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });

      const promptDoc = await convex.query(api.coursePrompts.getPrompt, {
        name: "answer_evaluator",
      });
      const prompt = renderPrompt(promptDoc.content, {
        questionText: question.question,
        questionAnswer: question.answer ?? "N/A",
        userAnswer: answer,
      });

      // Enhanced model selection with fallback strategy
      const primaryModel = process.env.GEMINI_MODEL ?? "gemini-3-flash-preview";
      const fallbackModel = "gemini-2.5-flash";
      let modelUsed = primaryModel;
      let response;

      try {
        const aiStartedAt = Date.now();
        logInfo("Answer validation AI generation started", {
          source: "api.tests.validate",
          requestId,
          route: "/api/tests/validate",
          userId,
          questionId,
          ai_provider: "google",
          ai_model: primaryModel,
        });
        response = await ai.models.generateContent({
          model: primaryModel,
          contents: prompt,
          config: { responseMimeType: "application/json" },
        });
        captureAiGenerationEvent({
          distinctId: userId,
          traceId: aiTraceId,
          provider: "google",
          model: primaryModel,
          input: [{ role: "user", content: prompt }],
          response,
          latencySeconds: (Date.now() - aiStartedAt) / 1000,
        });
        logInfo("Answer validation AI generation succeeded", {
          source: "api.tests.validate",
          requestId,
          route: "/api/tests/validate",
          userId,
          questionId,
          ai_provider: "google",
          ai_model: primaryModel,
          duration_ms: Date.now() - aiStartedAt,
        });
      } catch (err: unknown) {
        logWarn("Primary validation model failed, trying fallback", {
          source: "api.tests.validate",
          requestId,
          route: "/api/tests/validate",
          userId,
          questionId,
          ai_provider: "google",
          ai_model: primaryModel,
          fallback_model: fallbackModel,
          ...getErrorAttributes(err),
        });
        modelUsed = fallbackModel;
        const aiStartedAt = Date.now();
        logInfo("Fallback validation AI generation started", {
          source: "api.tests.validate",
          requestId,
          route: "/api/tests/validate",
          userId,
          questionId,
          ai_provider: "google",
          ai_model: fallbackModel,
        });
        response = await ai.models.generateContent({
          model: fallbackModel,
          contents: prompt,
          config: { responseMimeType: "application/json" },
        });
        captureAiGenerationEvent({
          distinctId: userId,
          traceId: aiTraceId,
          provider: "google",
          model: fallbackModel,
          input: [{ role: "user", content: prompt }],
          response,
          latencySeconds: (Date.now() - aiStartedAt) / 1000,
        });
        logInfo("Fallback validation AI generation succeeded", {
          source: "api.tests.validate",
          requestId,
          route: "/api/tests/validate",
          userId,
          questionId,
          ai_provider: "google",
          ai_model: fallbackModel,
          duration_ms: Date.now() - aiStartedAt,
        });
      }

      try {
        const responseText = response.text ?? "{}";
        const parsed = JSON.parse(responseText) as unknown;
        const validated = validateAIResponse(parsed);

        if (validated) {
          isCorrect = validated.isCorrect;
          aiFeedback = validated.feedback;
        } else {
          isCorrect = false;
          aiFeedback = "Failed to parse AI feedback format.";
        }
      } catch (e) {
        logWarn("Validation AI response parse failed", {
          source: "api.tests.validate",
          requestId,
          route: "/api/tests/validate",
          userId,
          questionId,
          ...getErrorAttributes(e),
        });
        isCorrect = false;
        aiFeedback = "Failed to parse AI outcome.";
      }

      modelUsedResult = modelUsed;
    }

    const targetKnowledgePieceId = resolveTargetPieceId(
      knowledgePieceId,
      test.knowledgePieceId,
    );

    // Update the question
    await convex.mutation(api.questions.updateFeedback, {
      questionId: questionId as Id<"questions">,
      isCorrect,
      aiFeedback,
      userAnswer: answer,
    });

    // Focus Area logic (Attempt for all, backend will enforce Pro plan)
    try {
      if (isCorrect && question.knowledgeNodeId) {
        // Resolve the node
        await convex.mutation(api.knowledgeNodes.resolve, {
          id: question.knowledgeNodeId,
        });
      } else if (!isCorrect && targetKnowledgePieceId) {
        // Spawn a new struggle node
        let struggleNote = `Failed on: "${question.question}".`;
        if (aiFeedback && aiFeedback !== "Incorrect.") {
          struggleNote += ` Feedback: ${aiFeedback}`;
        }

        await convex.mutation(api.knowledgeNodes.create, {
          spaceId: test.spaceId,
          knowledgePieceId: targetKnowledgePieceId,
          type: "struggle",
          content: struggleNote,
        });
      }
    } catch (planError: unknown) {
      if (!hasPlanLimitCode(planError, PLAN_LIMIT_CODE)) {
        logError("Knowledge node update failed after validation", {
          source: "api.tests.validate",
          requestId,
          route: "/api/tests/validate",
          userId,
          questionId,
          ...getErrorAttributes(planError),
        });
      }
    }

    const responseBody: {
      isCorrect: boolean;
      aiFeedback: string;
      _meta?: { modelUsed: string };
    } = {
      isCorrect,
      aiFeedback,
    };
    if (modelUsedResult) {
      responseBody._meta = { modelUsed: modelUsedResult };
    }

    logInfo("Test answer validation succeeded", {
      source: "api.tests.validate",
      requestId,
      route: "/api/tests/validate",
      userId,
      questionId,
      testType,
      isCorrect,
      duration_ms: Date.now() - startedAt,
    });

    return NextResponse.json(responseBody);
  } catch (err: unknown) {
    logError("Test answer validation failed", {
      source: "api.tests.validate",
      requestId,
      route: "/api/tests/validate",
      duration_ms: Date.now() - startedAt,
      ...getErrorAttributes(err),
    });
    return jsonError(500, "Internal server error");
  }
}
