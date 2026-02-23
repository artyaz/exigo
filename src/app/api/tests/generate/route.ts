import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenAI } from "@google/genai";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { z, type ZodTypeAny } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

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

async function fetchGeminiStream(ai: GoogleGenAI, prompt: string, schema: ZodTypeAny) {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            return await ai.models.generateContentStream({
                model: "gemini-3.1-pro-preview",
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                    responseJsonSchema: zodToJsonSchema(schema),
                }
            });
        } catch (retryErr: unknown) {
            const apiErr = retryErr as { status?: number };
            if (apiErr.status === 429 && attempt < 2) {
                await new Promise((r) => setTimeout(r, (attempt + 1) * 2000));
                continue;
            }
            throw retryErr;
        }
    }
    throw new Error("Failed to get stream after retries");
}

export async function POST(req: NextRequest) {
    const rawBody = await req.json() as Record<string, unknown>;
    const spaceId = rawBody.spaceId as string;
    const testType = rawBody.testType as string;
    const testId = rawBody.testId as string | undefined;
    const knowledgePieceId = rawBody.knowledgePieceId as string | undefined;

    if (!spaceId || !testType || !process.env.GOOGLE_GEMINI_API_KEY) {
        return new Response(JSON.stringify({ error: "Missing params or API key" }), { status: 400 });
    }

    const ALLOWED_TYPES = ["select", "write"] as const;
    if (!ALLOWED_TYPES.includes(testType as typeof ALLOWED_TYPES[number])) {
        return new Response(JSON.stringify({ error: "Invalid testType — must be 'select' or 'write'" }), { status: 400 });
    }

    const { userId, has } = await auth();
    if (!userId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const hasUnlimitedTests = has({ feature: "unlimited_ai_tests" });
    const hasProTests = has({ feature: "pro_tests" });

    // Determine limit
    const MAX_TESTS = hasUnlimitedTests ? Infinity : (hasProTests ? 100 : 10);

    // Check count for user this month
    const testsThisMonth = await convex.query(api.tests.countForUserThisMonth, { userId });

    if (testsThisMonth >= MAX_TESTS) {
        return new Response(JSON.stringify({
            error: "Limit Reached",
            message: `You have reached your limit of ${MAX_TESTS} tests for this month. Please upgrade your plan.`
        }), { status: 403 });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });
    const pieces = await convex.query(api.knowledgePieces.getForSpace, { spaceId: spaceId as Id<"spaces"> });

    if (!pieces || pieces.length === 0) {
        return new Response(JSON.stringify({ error: "No knowledge pieces" }), { status: 400 });
    }

    // Select knowledge piece(s): specific one, or random
    type KPiece = (typeof pieces)[number];
    let selectedPieces: KPiece[];
    if (knowledgePieceId) {
        const target = pieces.find(p => String(p._id) === knowledgePieceId);
        if (!target) {
            return new Response(JSON.stringify({ error: "Knowledge piece not found" }), { status: 404 });
        }
        selectedPieces = [target];
    } else {
        // Random selection: pick one random piece
        // Using Math.random is safe here for non-cryptographic knowledge piece selection.
        selectedPieces = [pieces[Math.floor(Math.random() * pieces.length)]!];
    }

    const firstPiece = selectedPieces[0]!;
    const topicLabel = firstPiece.title ?? firstPiece.content.slice(0, 40);

    let existingQuestions: { question: string }[] = [];
    let activeTestId: Id<"tests">;

    if (testId) {
        // Verify test belongs to this space and matches requested type
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
        activeTestId = testId as Id<"tests">;
        existingQuestions = await convex.query(api.questions.getForTest, { testId: activeTestId });
    } else {
        activeTestId = await convex.mutation(api.tests.createEmptyTest, {
            spaceId: spaceId as Id<"spaces">,
            type: testType,
            questionCount: 5,
            topicTitle: topicLabel,
            userId: userId,
        });
    }

    const incorrectQuestions = await convex.query(api.questions.getIncorrectForTopic, {
        spaceId: spaceId as Id<"spaces">,
        topicTitle: topicLabel
    });

    const knowledgeText = selectedPieces.map(p => p.content).join("\n\n---\n\n");
    let contextPrompt = "";
    if (existingQuestions.length > 0) {
        contextPrompt += "\n\nCRITICAL: Do NOT ask questions similar to the following previously generated questions in this test:\n" +
            existingQuestions.map((q, i) => `${i + 1}. ${q.question}`).join("\n");
    }

    if (incorrectQuestions.length > 0) {
        contextPrompt += "\n\nThe user previously struggled with the following questions. You CAN ask similar questions to test if they have learned from their mistakes, or create new ones targeting their weak points:\n" +
            incorrectQuestions.map((q, i) => `${i + 1}. Question: ${q.question}\n   User's wrong answer: ${q.userAnswer ?? "N/A"}\n   Correct concept feedback: ${q.aiFeedback ?? "N/A"}`).join("\n\n");
    }

    const prompt = `You are an expert educator. Generate EXACTLY ONE tricky, conceptual question (no simple definitions; focus on "why" and edge cases) based ONLY on the following knowledge pieces.

IMPORTANT: If the knowledge pieces contain examples of existing questions, tests, or chat histories with grades, DO NOT copy them. You must create a NEW, original question that tests the underlying concepts.${contextPrompt}

The question type requested is: ${testType} ('select' means multiple choice, 'write' means open-ended).

If 'select', provide exactly 4 options per question, and indicate the exactly complete answer string.
If 'write', do not provide options, just provide a sample correct answer.

Knowledge:
${knowledgeText}`;

    const schema = testType === "select" ? selectQuestionSchema : writeQuestionSchema;

    // Create a streaming response back to the client
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
        async start(controller) {
            try {
                const stream = await fetchGeminiStream(ai, prompt, schema);

                let fullText = "";

                for await (const chunk of stream) {
                    const part = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (part) {
                        fullText += part;
                        // Send the delta to the client as SSE
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "delta", text: part })}\n\n`));
                    }
                }

                // Parse the completed JSON
                const parsed = schema.parse(JSON.parse(fullText));

                // Save to Convex
                const parsedOptions = "options" in parsed ? (parsed as { options: string[] }).options : undefined;
                const questionId = await convex.mutation(api.questions.create, {
                    testId: activeTestId,
                    type: testType,
                    question: parsed.question,
                    options: parsedOptions,
                    answer: parsed.answer,
                });

                // Send the final event
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", testId: activeTestId, questionId })}\n\n`));
                controller.close();

            } catch (err) {
                console.error("Stream error:", err);
                const msg = err instanceof Error ? err.message : "Unknown error";
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", error: msg })}\n\n`));
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