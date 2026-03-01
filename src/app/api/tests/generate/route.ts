import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenAI } from "@google/genai";
import type { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
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
    logWarn,
} from "../../../../lib/otlpLogger";

const selectQuestionSchema = z.object({
    question: z.string().describe("The question text"),
    options: z.array(z.string()).length(4).describe("Exactly 4 answer options"),
    answer: z.string().describe("The correct answer, must match one of the options exactly"),
}).superRefine((data, ctx) => {
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
    context: { requestId: string; userId: string; route: string; }
) {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            return await ai.models.generateContentStream({
                model,
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseJsonSchema: zodToJsonSchema(schema),
                }
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

function createJsonErrorResponse(params: {
    status: number;
    code: string;
    message: string;
    requestId: string;
    details?: Record<string, unknown>;
}): Response {
    return new Response(
        JSON.stringify({
            error: params.message,
            code: params.code,
            requestId: params.requestId,
            details: params.details,
        }),
        {
            status: params.status,
            headers: { "Content-Type": "application/json" },
        }
    );
}

function parseGenerateBody(rawBody: Record<string, unknown>): GenerateBody {
    return {
        spaceId: rawBody.spaceId as string,
        testType: rawBody.testType as string,
        testId: rawBody.testId as string | undefined,
        knowledgePieceId: rawBody.knowledgePieceId as string | undefined,
    };
}

function selectKnowledgePieces(pieces: KPiece[], knowledgePieceId?: string): KPiece[] | Response {
    if (knowledgePieceId) {
        const target = pieces.find(p => String(p._id) === knowledgePieceId);
        if (!target) {
            return new Response(JSON.stringify({ error: "Knowledge piece not found" }), { status: 404 });
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
    knowledgePieceId?: string
): Promise<{ id: Id<"tests">; existingQuestions: { question: string }[] } | Response> {

    if (testId) {
        const existingTest = await convex.query(api.tests.get, { testId: testId as Id<"tests"> });
        if (!existingTest) {
            return new Response(JSON.stringify({ error: "Test not found" }), { status: 404 });
        }
        if (String(existingTest.spaceId) !== spaceId) {
            return new Response(JSON.stringify({ error: "Test does not belong to this space" }), { status: 400 });
        }
        if (existingTest.config.type !== testType) {
            return new Response(JSON.stringify({ error: "Test type mismatch" }), { status: 400 });
        }
        const existingQuestions = await convex.query(api.questions.getForTest, { testId: testId as Id<"tests"> });
        return { id: testId as Id<"tests">, existingQuestions };
    }
    const createArgs = {
        spaceId: spaceId as Id<"spaces">,
        type: testType,
        questionCount: 5,
        topicTitle: topicLabel,
        userId,
        ...(knowledgePieceId ? { knowledgePieceId: knowledgePieceId as Id<"knowledgePieces"> } : {}),
    };
    const id = await convex.mutation(api.tests.createEmptyTest, createArgs);


    return { id, existingQuestions: [] };
}

function buildContextPrompt(
    existingQuestions: { question: string }[],
    incorrectQuestions: { question: string; userAnswer?: string; aiFeedback?: string }[],
    activeNodes: { _id: Id<"knowledgeNodes">, type: string, content: string }[]
): string {
    let contextPrompt = "";
    if (existingQuestions.length > 0) {
        contextPrompt += "\n\nCRITICAL: Do NOT ask questions similar to the following previously generated questions in this test:\n" +
            existingQuestions.map((q, i) => `${i + 1}. ${q.question}`).join("\n");
    }

    if (activeNodes.length > 0) {
        // Pick a node probabilistically (for now, simply favor struggle nodes over improvement, or pick one randomly)
        // A robust choice is to just pass the nodes and ask AI to focus on them.
        contextPrompt += "\n\nThe student has specific learning focus areas (Knowledge Nodes). PLEASE PRIORITIZE testing these concepts:\n";
        activeNodes.forEach((node, i) => {
            contextPrompt += `${i + 1}. [${node.type.toUpperCase()}] ${node.content}\n`;
        });
        contextPrompt += "\nYou should formulate your question to directly address one of the concepts above if possible.\n";
    }

    if (incorrectQuestions.length > 0) {
        contextPrompt += "\n\nThe user previously struggled with the following questions. You CAN ask similar questions to test if they have learned from their mistakes, or create new ones targeting their weak points:\n" +
            incorrectQuestions.map((q, i) => `${i + 1}. Question: ${q.question}\n   User's wrong answer: ${q.userAnswer ?? "N/A"}\n   Correct concept feedback: ${q.aiFeedback ?? "N/A"}`).join("\n\n");
    }
    return contextPrompt;
}

export async function POST(req: NextRequest) {
    const requestId = createRequestId(req.headers);
    const startedAt = Date.now();
    const rawBody = await req.json() as Record<string, unknown>;
    const { spaceId, testType, testId, knowledgePieceId } = parseGenerateBody(rawBody);

    const missingFields: string[] = [];
    if (!spaceId) missingFields.push("spaceId");
    if (!testType) missingFields.push("testType");
    if (!process.env.GOOGLE_GEMINI_API_KEY) missingFields.push("GOOGLE_GEMINI_API_KEY");
    if (missingFields.length > 0) {
        return createJsonErrorResponse({
            status: 400,
            code: "INVALID_REQUEST",
            message: "Missing required request fields or server configuration.",
            requestId,
            details: { missingFields },
        });
    }

    const ALLOWED_TYPES = ["select", "write"] as const;
    if (!ALLOWED_TYPES.includes(testType as typeof ALLOWED_TYPES[number])) {
        return createJsonErrorResponse({
            status: 400,
            code: "INVALID_TEST_TYPE",
            message: "Invalid testType — must be 'select' or 'write'.",
            requestId,
            details: { testType },
        });
    }

    const { userId, getToken } = await auth();
    if (!userId) {
        return createJsonErrorResponse({
            status: 401,
            code: "UNAUTHORIZED",
            message: "Unauthorized",
            requestId,
        });
    }

    logInfo("Test generation request received", {
        source: "api.tests.generate",
        requestId,
        route: "/api/tests/generate",
        userId,
        spaceId,
        testId,
        testType,
    });

    let convex: ConvexHttpClient;
    try {
        convex = await createAuthedConvexClient(getToken, "api.tests.generate");
    } catch (error) {
        logError("Failed to initialize Convex client for generation", {
            source: "api.tests.generate",
            requestId,
            route: "/api/tests/generate",
            userId,
            duration_ms: Date.now() - startedAt,
            ...getErrorAttributes(error),
        });
        if (error instanceof ConvexAuthError) {
            return createJsonErrorResponse({
                status: 401,
                code: "CONVEX_AUTH_MISSING",
                message: "Unauthorized: Missing Convex auth token.",
                requestId,
            });
        }
        const msg = error instanceof Error ? error.message : "Unauthorized";
        return createJsonErrorResponse({
            status: 500,
            code: "CONVEX_CLIENT_INIT_FAILED",
            message: msg,
            requestId,
        });
    }

    const [planStatus, testsThisMonth] = await Promise.all([
        convex.query(api.planLimits.getPlan, {}),
        convex.query(api.tests.countForUserThisMonth, { userId }),
    ]);
    const maxTests = planStatus.limits.maxTestsPerMonth;
    if (!planStatus.hasActiveSubscription) {
        return createJsonErrorResponse({
            status: 403,
            code: "TEST_SUBSCRIPTION_REQUIRED",
            message: "Test generation requires an active subscription.",
            requestId,
            details: {
                tier: planStatus.tier,
                testsThisMonth,
                maxTestsPerMonth: maxTests,
                planSource: "convex.subscriptions",
            },
        });
    }
    if (maxTests === 0) {
        return createJsonErrorResponse({
            status: 403,
            code: "TEST_PLAN_ACCESS_DENIED",
            message: "Your current plan does not include test generation.",
            requestId,
            details: {
                tier: planStatus.tier,
                testsThisMonth: 0,
                maxTestsPerMonth: maxTests,
                planSource: "convex.planLimits.getPlan",
            },
        });
    }

    if (Number.isFinite(maxTests) && testsThisMonth >= maxTests) {
        return createJsonErrorResponse({
            status: 403,
            code: "TEST_MONTHLY_LIMIT_REACHED",
            message: `You have reached your monthly test limit (${testsThisMonth}/${maxTests}).`,
            requestId,
            details: {
                tier: planStatus.tier,
                testsThisMonth,
                maxTestsPerMonth: maxTests,
                planSource: "convex.planLimits.getPlan",
            },
        });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });

    // Verify space ownership before accessing data
    const space = await convex.query(api.spaces.get, { spaceId: spaceId as Id<"spaces">, userId });
    if (!space) {
        return createJsonErrorResponse({
            status: 403,
            code: "SPACE_ACCESS_DENIED",
            message: "Access denied to this space or space not found.",
            requestId,
            details: { spaceId },
        });
    }


    const pieces = await convex.query(api.knowledgePieces.getForSpace, { spaceId: spaceId as Id<"spaces"> });
    if (!pieces || pieces.length === 0) {
        return createJsonErrorResponse({
            status: 400,
            code: "NO_KNOWLEDGE_PIECES",
            message: "No knowledge pieces found for this space.",
            requestId,
            details: { spaceId },
        });
    }

    const selectedResult = selectKnowledgePieces(pieces, knowledgePieceId);
    if (selectedResult instanceof Response) return selectedResult;
    const selectedPieces = selectedResult;

    const firstPiece = selectedPieces[0]!;
    const topicLabel = firstPiece.title ?? firstPiece.content.slice(0, 40);
    const effectiveKnowledgePieceId = knowledgePieceId ?? String(firstPiece._id);

    let testResult: { id: Id<"tests">; existingQuestions: { question: string }[] } | Response;
    try {
        testResult = await resolveTestId(convex, testId, spaceId, testType, topicLabel, userId, effectiveKnowledgePieceId);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("Subscription required")) {
            return createJsonErrorResponse({
                status: 403,
                code: "TEST_SUBSCRIPTION_REQUIRED",
                message: "Test generation requires an active subscription.",
                requestId,
                details: {
                    tier: planStatus.tier,
                    testsThisMonth,
                    maxTestsPerMonth: maxTests,
                    planSource: "convex.subscriptions",
                },
            });
        }
        if (message.includes("don't have access to test generation")) {
            return createJsonErrorResponse({
                status: 403,
                code: "TEST_PLAN_ACCESS_DENIED",
                message: "Your current plan does not include test generation.",
                requestId,
                details: {
                    tier: planStatus.tier,
                    testsThisMonth,
                    maxTestsPerMonth: maxTests,
                    planSource: "convex.planLimits.getPlan",
                },
            });
        }
        if (message.includes("Limit reached")) {
            return createJsonErrorResponse({
                status: 403,
                code: "TEST_MONTHLY_LIMIT_REACHED",
                message: `You have reached your monthly test limit (${testsThisMonth}/${maxTests}).`,
                requestId,
                details: {
                    tier: planStatus.tier,
                    testsThisMonth,
                    maxTestsPerMonth: maxTests,
                    planSource: "convex.planLimits.getPlan",
                },
            });
        }
        return createJsonErrorResponse({
            status: 500,
            code: "TEST_CREATE_FAILED",
            message: message || "Failed to create or load test.",
            requestId,
        });
    }
    if (testResult instanceof Response) return testResult;
    const { id: activeTestId, existingQuestions } = testResult;

    const incorrectQuestions = await convex.query(api.questions.getIncorrectForTopic, {
        spaceId: spaceId as Id<"spaces">,
        topicTitle: topicLabel
    });

    let activeNodes: { _id: Id<"knowledgeNodes">, type: string, content: string }[] = [];
    const isPro = planStatus.tier === "pro" || planStatus.tier === "educator";
    if (effectiveKnowledgePieceId && isPro) {
        activeNodes = await convex.query(api.knowledgeNodes.getActiveForPiece, {
            knowledgePieceId: effectiveKnowledgePieceId as Id<"knowledgePieces">
        });
    }

    // Give higher probability to nodes. We can randomly pick one node to be the absolute focus.
    let focusedNodeId: Id<"knowledgeNodes"> | undefined = undefined;
    if (activeNodes.length > 0) {
        // 70% chance to focus on a specific node, otherwise feed all of them.
        if (Math.random() < 0.7) {
            const weights = activeNodes.map(n => n.type === "struggle" ? 2 : 1);
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


    const knowledgeText = selectedPieces.map(p => p.content).join("\n\n---\n\n");
    const contextPrompt = buildContextPrompt(existingQuestions, incorrectQuestions, activeNodes);

    const prompt = `You are an expert educator. Generate EXACTLY ONE tricky, conceptual question (no simple definitions; focus on "why" and edge cases) based ONLY on the following knowledge pieces.

IMPORTANT: If the knowledge pieces contain examples of existing questions, tests, or chat histories with grades, DO NOT copy them. You must create a NEW, original question that tests the underlying concepts.${contextPrompt}

The question type requested is: ${testType} ('select' means multiple choice, 'write' means open-ended).

If 'select', provide exactly 4 options per question, and indicate the exactly complete answer string.
If 'write', do not provide options, just provide a sample correct answer.

Knowledge:
${knowledgeText}`;

    const schema = testType === "select" ? selectQuestionSchema : writeQuestionSchema;
    const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
    const aiTraceId = createAiTraceId();

    // Create a streaming response back to the client
    const encoder = new TextEncoder();

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
                        // Send the delta to the client as SSE
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "delta", text: part })}\n\n`));
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
                const parsedOptions = "options" in parsed ? (parsed as { options: string[] }).options : undefined;
                const questionId = await convex.mutation(api.questions.create, {
                    testId: activeTestId,
                    userId,
                    type: testType,
                    question: parsed.question,
                    options: parsedOptions,
                    answer: parsed.answer,
                    knowledgeNodeId: focusedNodeId,
                });

                // Send the final event
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", testId: activeTestId, questionId })}\n\n`));
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
                const msg = err instanceof Error ? err.message : "Unknown error";
                controller.enqueue(
                    encoder.encode(
                        `data: ${JSON.stringify({
                            type: "error",
                            error: msg,
                            code: "GENERATION_STREAM_FAILED",
                            requestId,
                        })}\n\n`
                    )
                );
                controller.close();
            }
        }
    });

    return new Response(readable, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    });
}
