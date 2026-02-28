import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenAI } from "@google/genai";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import {
  ConvexAuthError,
  createAuthedConvexClient,
} from "../../../../lib/convexClientAuth";
import { PLAN_LIMIT_CODE } from "../../../../../shared/planConfig";

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
  try {
    const { userId, getToken } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const convex = await createAuthedConvexClient(
      getToken,
      "api.tests.validate",
    );

    let rawBody: Record<string, unknown>;
    try {
      rawBody = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
    }

    const questionId = rawBody.questionId;
    const answer = rawBody.answer;
    const testType = rawBody.testType;
    const knowledgePieceId = rawBody.knowledgePieceId;

    if (
      typeof questionId !== "string" ||
      typeof answer !== "string" ||
      typeof testType !== "string"
    ) {
      return NextResponse.json(
        { error: "Missing or invalid required fields" },
        { status: 400 },
      );
    }

    if (
      knowledgePieceId !== undefined &&
      typeof knowledgePieceId !== "string"
    ) {
      return NextResponse.json(
        { error: "Invalid knowledgePieceId" },
        { status: 400 },
      );
    }

    if (testType !== "select" && testType !== "write") {
      return NextResponse.json(
        { error: "Invalid testType — must be 'select' or 'write'" },
        { status: 400 },
      );
    }

    // Validate active question directly
    const question = await convex.query(api.questions.get, {
      questionId: questionId as Id<"questions">,
    });
    if (!question)
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 },
      );

    // Verify ownership via space
    const test = await convex.query(api.tests.get, { testId: question.testId });
    if (!test)
      return NextResponse.json({ error: "Test not found" }, { status: 404 });

    const space = await convex.query(api.spaces.get, {
      spaceId: test.spaceId,
      userId,
    });
    if (!space) {
      return NextResponse.json(
        { error: "Unauthorized access or space not found" },
        { status: 403 },
      );
    }

    let modelUsedResult: string | undefined;
    let isCorrect = false;
    let aiFeedback = "Correct!";

    if (testType === "select") {
      isCorrect = answer === question.answer;
      aiFeedback = isCorrect
        ? "Correct answer!"
        : `Incorrect. The correct answer was: ${question.answer}`;
    } else if (testType === "write") {
      const planStatus = await convex.query(api.planLimits.getPlan, {});
      if (planStatus.tier !== "educator") {
        return NextResponse.json(
          {
            error:
              "AI feedback for written answers is available on Educator plan. Please upgrade your plan.",
          },
          { status: 403 },
        );
      }

      if (!process.env.GOOGLE_GEMINI_API_KEY) {
        return NextResponse.json(
          { error: "Server missing Gemini API key" },
          { status: 500 },
        );
      }
      const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });

      const prompt = `
        You are a strict but encouraging educator evaluating a student's answer.
        
        Question: ${question.question}
        Perfect Answer Outline: ${question.answer}
        
        Student's Answer: ${answer}
        
        Evaluate the student's answer. Is it fundamentally correct and captures the core meaning?
        Respond STRICTLY with a JSON object: {"isCorrect": true/false, "feedback": "Brief 1 sentence explanation of why, or praise if correct"}
      `;

      // Enhanced model selection with fallback strategy
      const primaryModel = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
      const fallbackModel = "gemini-1.5-flash";
      let modelUsed = primaryModel;
      let response;

      try {
        response = await ai.models.generateContent({
          model: primaryModel,
          contents: prompt,
          config: { responseMimeType: "application/json" },
        });
      } catch (err: unknown) {
        console.error(
          `Primary model (${primaryModel}) failed, trying fallback (${fallbackModel}):`,
          err,
        );
        modelUsed = fallbackModel;
        response = await ai.models.generateContent({
          model: fallbackModel,
          contents: prompt,
          config: { responseMimeType: "application/json" },
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
        console.error("AI validation parse error:", e);
        isCorrect = false;
        aiFeedback = "Failed to parse AI outcome.";
      }

      modelUsedResult = modelUsed;
    }

    const targetKnowledgePieceId = resolveTargetPieceId(
      rawBody.knowledgePieceId as string | undefined,
      test.knowledgePieceId,
    );

    // Update the question
    await convex.mutation(api.questions.updateFeedback, {
      questionId: questionId as Id<"questions">,
      userId,
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
        console.error("Knowledge Node mutation failed:", planError);
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

    return NextResponse.json(responseBody);
  } catch (err: unknown) {
    console.error(err);
    if (err instanceof ConvexAuthError) {
      return NextResponse.json(
        { error: "Unauthorized: Missing Convex auth token." },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
