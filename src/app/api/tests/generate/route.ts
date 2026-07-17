import type { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import type { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { jsonError, requireAuthedApi } from "../../../../lib/apiAuth";
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
  logInfo,
  logWarn,
} from "../../../../lib/otlpLogger";
import { renderPrompt } from "../../../../../convex/coursePrompts";

const selectQuestionSchema = z
  .object({
    question: z.string().describe("The question text"),
    options: z.array(z.string()).length(4).describe("Exactly 4 answer options"),
    answer: z
      .string()
      .describe("The correct answer, must match one of the options exactly"),
  })
  .superRefine((data, ctx) => {
    if (!data.options.includes(data.answer)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "answer must be one of the provided options",
        path: ["answer"],
      });
    }
  });

const writeQuestionSchema = z.object({
  question: z.string().describe("The question text"),
  answer: z.string().describe("A sample correct answer"),
});

/**
 * Generates a single original question from knowledge pieces for a space and streams progress to the client via Server-Sent Events (SSE), then saves the created question to Convex.
 *
 * The request body must be JSON with `spaceId`, `testType` ("select" or "write"), and optional `testId`. The endpoint:
 * - Retrieves knowledge pieces for the given space.
 * - Optionally uses an existing test (when `testId` is provided`) or creates an empty test.
 * - Prompts an AI model to produce exactly one question in a strict JSON schema(multiple - choice or open - ended).
 * - Streams incremental text deltas to the client as SSE events of type`"delta"`.
 * - On success persists the question and emits a final SSE `"done"` event containing `testId` and`questionId`.
 * - Emits an SSE `"error"` event on failure.
 *
 * @param req - Incoming NextRequest whose JSON body contains`{ spaceId: string, testType: "select" | "write", testId?: string }`.
 * @returns A Response whose body is an SSE stream(Content - Type: text / event - stream).The stream emits JSON events:
 * - `{"type":"delta","text":string}` for incremental model output,
 * - `{"type":"done","testId":string,"questionId":string}` when the question is saved,
 * - `{"type":"error","error":string}` on error.
 * The endpoint also returns 400 responses(JSON error body) when required parameters or knowledge pieces are missing.
 */

async function fetchGeminiStream<T extends z.ZodSchema>(
  ai: GoogleGenAI,
  prompt: string,
  schema: T,
  model: string,
  context: { requestId: string; userId: string; route: string },
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await ai.models.generateContentStream({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: zodToJsonSchema(schema),
        },
      });
    } catch (retryErr: unknown) {
      const apiErr = retryErr as { status?: number };
      if (apiErr.status === 429 && attempt < 2) {
        logWarn("Gemini stream rate-limited, retrying", {
          source: "api.tests.generate",
          requestId: context.requestId,
          route: context.route,
          userId: context.userId,
          ai_provider: "google",
          ai_model: model,
          attempt: attempt + 1,
          http_status: 429,
        });
        await new Promise((r) => setTimeout(r, (attempt + 1) * 2000));
        continue;
      }
      throw retryErr;
    }
  }
  throw new Error("Failed to get stream after retries");
}

type KPiece = { _id: Id<"knowledgePieces">; content: string; title?: string };

type GenerateBody = {
  spaceId: string;
  testType: string;
  testId?: string;
  knowledgePieceId?: string;
};

function parseGenerateBody(rawBody: Record<string, unknown>): GenerateBody {
  return {
    spaceId: rawBody.spaceId as string,
    testType: rawBody.testType as string,
    testId: rawBody.testId as string | undefined,
    knowledgePieceId: rawBody.knowledgePieceId as string | undefined,
  };
}

function selectKnowledgePieces(
  pieces: KPiece[],
  knowledgePieceId?: string,
): KPiece[] | Response {
  if (knowledgePieceId) {
    const target = pieces.find((p) => String(p._id) === knowledgePieceId);
    if (!target) {
      return new Response(
        JSON.stringify({ error: "Knowledge piece not found" }),
        { status: 404 },
      );
    }
    return [target];
  }
  // Using Math.random is safe here for non-cryptographic knowledge piece selection.
  return [pieces[Math.floor(Math.random() * pieces.length)]!];
}

async function resolveTestId(
  convex: ConvexHttpClient,
  testId: string | undefined,
  spaceId: string,
  testType: string,
  topicLabel: string,
  userId: string,
  knowledgePieceId?: string,
): Promise<
  { id: Id<"tests">; existingQuestions: { question: string }[] } | Response
> {
  if (testId) {
    const existingTest = await convex.query(api.tests.get, {
      testId: testId as Id<"tests">,
    });
    if (!existingTest) {
      return new Response(JSON.stringify({ error: "Test not found" }), {
        status: 404,
      });
    }
    if (String(existingTest.spaceId) !== spaceId) {
      return new Response(
        JSON.stringify({ error: "Test does not belong to this space" }),
        { status: 400 },
      );
    }
    if (existingTest.config.type !== testType) {
      return new Response(JSON.stringify({ error: "Test type mismatch" }), {
        status: 400,
      });
    }
    const existingQuestions = await convex.query(api.questions.getForTest, {
      testId: testId as Id<"tests">,
    });
    return { id: testId as Id<"tests">, existingQuestions };
  }
  const createArgs = {
    spaceId: spaceId as Id<"spaces">,
    type: testType,
    questionCount: 5,
    topicTitle: topicLabel,
    userId,
    ...(knowledgePieceId
      ? { knowledgePieceId: knowledgePieceId as Id<"knowledgePieces"> }
      : {}),
  };
  const id = await convex.mutation(api.tests.createEmptyTest, createArgs);

  return { id, existingQuestions: [] };
}

function buildContextPrompt(
  existingQuestions: { question: string }[],
  incorrectQuestions: {
    question: string;
    userAnswer?: string;
    aiFeedback?: string;
  }[],
  activeNodes: { _id: Id<"knowledgeNodes">; type: string; content: string }[],
): string {
  let contextPrompt = "";
  if (existingQuestions.length > 0) {
    contextPrompt +=
      "\n\nCRITICAL: Do NOT ask questions similar to the following previously generated questions in this test:\n" +
      existingQuestions.map((q, i) => `${i + 1}. ${q.question}`).join("\n");
  }

  if (activeNodes.length > 0) {
    // Pick a node probabilistically (for now, simply favor struggle nodes over improvement, or pick one randomly)
    // A robust choice is to just pass the nodes and ask AI to focus on them.
    contextPrompt +=
      "\n\nThe student has specific learning focus areas (Knowledge Nodes). PLEASE PRIORITIZE testing these concepts:\n";
    activeNodes.forEach((node, i) => {
      contextPrompt += `${i + 1}. [${node.type.toUpperCase()}] ${node.content}\n`;
    });
    contextPrompt +=
      "\nYou should formulate your question to directly address one of the concepts above if possible.\n";
  }

  if (incorrectQuestions.length > 0) {
    contextPrompt +=
      "\n\nThe user previously struggled with the following questions. You CAN ask similar questions to test if they have learned from their mistakes, or create new ones targeting their weak points:\n" +
      incorrectQuestions
        .map(
          (q, i) =>
            `${i + 1}. Question: ${q.question}\n   User's wrong answer: ${q.userAnswer ?? "N/A"}\n   Correct concept feedback: ${q.aiFeedback ?? "N/A"}`,
        )
        .join("\n\n");
  }
  return contextPrompt;
}

export async function POST(req: NextRequest) {
  const requestId = createRequestId(req.headers);
  const startedAt = Date.now();
  let rawBody: Record<string, unknown>;
  try {
    rawBody = (await req.json()) as Record<string, unknown>;
  } catch {
    return new Response(JSON.stringify({ error: "Malformed JSON" }), {
      status: 400,
    });
  }
  const { spaceId, testType, testId, knowledgePieceId } =
    parseGenerateBody(rawBody);

  if (!spaceId || !testType) {
    return jsonError(400, "Missing params");
  }

  if (!process.env.GOOGLE_GEMINI_API_KEY) {
    logError("Test generation missing GOOGLE_GEMINI_API_KEY", {
      source: "api.tests.generate",
      requestId,
      route: "/api/tests/generate",
    });
    return jsonError(500, "Server configuration error");
  }

  const ALLOWED_TYPES = ["select", "write"] as const;
  if (!ALLOWED_TYPES.includes(testType as (typeof ALLOWED_TYPES)[number])) {
    return jsonError(400, "Invalid testType — must be 'select' or 'write'");
  }

  const authResult = await requireAuthedApi("api.tests.generate", {
    requestId,
    route: "/api/tests/generate",
    duration_ms: Date.now() - startedAt,
  });
  if (authResult instanceof Response) return authResult;
  const { userId, convex } = authResult;

  logInfo("Test generation request received", {
    source: "api.tests.generate",
    requestId,
    route: "/api/tests/generate",
    userId,
    spaceId,
    testId,
    testType,
  });

  const planStatus = await convex.query(api.planLimits.getPlan, {});
  const MAX_TESTS = planStatus.limits.maxTestsPerMonth;
  if (MAX_TESTS === 0) {
    return new Response(
      JSON.stringify({
        error: "Access Denied",
        message:
          "You don't have access to test generation. Please upgrade your plan.",
      }),
      { status: 403 },
    );
  }

  const testsThisMonth = await convex.query(api.tests.countForUserThisMonth, {
    userId,
  });
  if (testsThisMonth >= MAX_TESTS) {
    return new Response(
      JSON.stringify({
        error: "Limit Reached",
        message: `You have reached your limit of ${MAX_TESTS} tests for this month. Please upgrade your plan.`,
      }),
      { status: 403 },
    );
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });

  // Verify space ownership before accessing data
  const space = await convex.query(api.spaces.get, {
    spaceId: spaceId as Id<"spaces">,
    userId,
  });
  if (!space) {
    return new Response(
      JSON.stringify({
        error: "Access denied to this space or space not found",
      }),
      { status: 403 },
    );
  }

  const pieces = await convex.query(api.knowledgePieces.getForSpace, {
    spaceId: spaceId as Id<"spaces">,
  });
  if (!pieces || pieces.length === 0) {
    return new Response(JSON.stringify({ error: "No knowledge pieces" }), {
      status: 400,
    });
  }

  const selectedResult = selectKnowledgePieces(pieces, knowledgePieceId);
  if (selectedResult instanceof Response) return selectedResult;
  const selectedPieces = selectedResult;

  const firstPiece = selectedPieces[0]!;
  const topicLabel = firstPiece.title ?? firstPiece.content.slice(0, 40);
  const effectiveKnowledgePieceId = knowledgePieceId ?? String(firstPiece._id);

  const testResult = await resolveTestId(
    convex,
    testId,
    spaceId,
    testType,
    topicLabel,
    userId,
    effectiveKnowledgePieceId,
  );
  if (testResult instanceof Response) return testResult;
  const { id: activeTestId, existingQuestions } = testResult;

  const incorrectQuestions = await convex.query(
    api.questions.getIncorrectForTopic,
    {
      spaceId: spaceId as Id<"spaces">,
      topicTitle: topicLabel,
    },
  );

  let activeNodes: {
    _id: Id<"knowledgeNodes">;
    type: string;
    content: string;
  }[] = [];
  const isPro = planStatus.tier === "pro" || planStatus.tier === "educator";
  if (effectiveKnowledgePieceId && isPro) {
    activeNodes = await convex.query(api.knowledgeNodes.getActiveForPiece, {
      knowledgePieceId: effectiveKnowledgePieceId as Id<"knowledgePieces">,
    });
  }

  // Give higher probability to nodes. We can randomly pick one node to be the absolute focus.
  let focusedNodeId: Id<"knowledgeNodes"> | undefined = undefined;
  if (activeNodes.length > 0) {
    // 70% chance to focus on a specific node, otherwise feed all of them.
    if (Math.random() < 0.7) {
      const weights = activeNodes.map((n) => (n.type === "struggle" ? 2 : 1));
      const totalWeight = weights.reduce((a, b) => a + b, 0);
      let rand = Math.random() * totalWeight;
      let selectedNode = activeNodes[0];
      for (let i = 0; i < activeNodes.length; i++) {
        if (rand < weights[i]!) {
          selectedNode = activeNodes[i];
          break;
        }
        rand -= weights[i]!;
      }
      if (selectedNode) {
        focusedNodeId = selectedNode._id;
        activeNodes = [selectedNode]; // Only pass this one to the prompt
      }
    }
  }

  const knowledgeText = selectedPieces
    .map((p) => p.content)
    .join("\n\n---\n\n");
  const contextPrompt = buildContextPrompt(
    existingQuestions,
    incorrectQuestions,
    activeNodes,
  );

  const promptDoc = await convex.query(api.coursePrompts.getPrompt, {
    name: "test_question_generator",
  });
  const prompt = renderPrompt(promptDoc.content, {
    contextPrompt,
    testType,
    knowledgeText,
  });

  const schema =
    testType === "select" ? selectQuestionSchema : writeQuestionSchema;
  const model = process.env.GEMINI_MODEL ?? "gemini-3-flash-preview";
  const aiTraceId = createAiTraceId();

  // Create a streaming response back to the client
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const requestStartedAt = Date.now();
        logInfo("Gemini stream generation started", {
          source: "api.tests.generate",
          requestId,
          route: "/api/tests/generate",
          userId,
          ai_provider: "google",
          ai_model: model,
          testId: String(activeTestId),
        });
        const stream = await fetchGeminiStream(ai, prompt, schema, model, {
          requestId,
          userId,
          route: "/api/tests/generate",
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
        logInfo("Gemini stream generation succeeded", {
          source: "api.tests.generate",
          requestId,
          route: "/api/tests/generate",
          userId,
          ai_provider: "google",
          ai_model: model,
          duration_ms: Date.now() - requestStartedAt,
          testId: String(activeTestId),
        });

        // Parse the completed JSON
        const parsed = schema.parse(JSON.parse(fullText));

        // Save to Convex
        const parsedOptions =
          "options" in parsed
            ? (parsed as { options: string[] }).options
            : undefined;
        const questionId = await convex.mutation(api.questions.create, {
          testId: activeTestId,
          type: testType,
          question: parsed.question,
          options: parsedOptions,
          answer: parsed.answer,
          knowledgeNodeId: focusedNodeId,
        });

        controller.enqueue(
          sseDone({ testId: activeTestId, questionId }),
        );
        logInfo("Generated test question persisted", {
          source: "api.tests.generate",
          requestId,
          route: "/api/tests/generate",
          userId,
          testId: String(activeTestId),
          questionId: String(questionId),
          duration_ms: Date.now() - startedAt,
        });
        controller.close();
      } catch (err) {
        logError("Test generation stream failed", {
          source: "api.tests.generate",
          requestId,
          route: "/api/tests/generate",
          userId,
          duration_ms: Date.now() - startedAt,
          ...getErrorAttributes(err),
        });
        // Opaque public message — real error logged above
        enqueueSseError(controller, "Test generation failed");
      }
    },
  });

  return sseResponse(readable);
}
