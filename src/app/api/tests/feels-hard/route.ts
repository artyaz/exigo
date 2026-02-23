import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenAI } from "@google/genai";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { createAuthedConvexClient } from "../../../../lib/convexClientAuth";
import { getDeepDiveLimitForTier } from "../../../../../shared/planConfig";

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

function buildPrompt(
    question: string,
    answer: string,
    userAnswer: string,
    messageContent: string,
    conversationContext: string
): string {
    return `You are an educational note-taker. A student interacted with an AI tutor while studying a test question and has flagged an AI explanation as "Feels hard" — meaning they struggled with the concept.

Based on the context below, generate a concise note (2-4 sentences) describing what the user struggled with and what specific concept needs reinforcement.

Format the note EXACTLY like this:
"User had an issue with understanding [topic]. Specifically, [describe the gap in understanding]. To improve, the user should focus on [specific recommendation]."

[Question]
${question}

[Correct Answer]
${answer}

[Student's Answer]
${userAnswer}

[AI Explanation that felt hard]
${messageContent}

[Full Conversation]
${conversationContext}

Important:
- Output ONLY the note text. No markdown, no quotes, no extra formatting.
- Be specific about the concept, not generic.
- Keep it under 4 sentences.`;
}

async function resolveTargetPiece(
    knowledgePieceId: string | undefined,
    testKnowledgePieceId: Id<"knowledgePieces"> | undefined
): Promise<Id<"knowledgePieces"> | null> {
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
    try {
        const { userId, getToken } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const convex = await createAuthedConvexClient(getToken, "api.tests.feels-hard");

        const planStatus = await convex.query(api.planLimits.getPlan, {});

        if (!planStatus.features.conversational_ai) {
            return NextResponse.json({ error: "Upgrade to Pro to use Deep Dive study notes!" }, { status: 403 });
        }

        const limit = getDeepDiveLimitForTier(planStatus.tier);


        if (!process.env.GOOGLE_GEMINI_API_KEY) {
            return NextResponse.json({ error: "Server missing Gemini API key" }, { status: 500 });
        }

        const { testId, questionId, messageContent, knowledgePieceId } = parseBody(
            (await req.json()) as Record<string, unknown>
        );
        if (!testId || !questionId || !messageContent) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const test = await convex.query(api.tests.get, { testId: testId as Id<"tests"> });
        if (!test) {
            return NextResponse.json({ error: "Test not found" }, { status: 404 });
        }

        const space = await convex.query(api.spaces.get, { spaceId: test.spaceId, userId });
        if (!space) {
            return NextResponse.json({ error: "Unauthorized access or space not found" }, { status: 403 });
        }

        const question = await convex.query(api.questions.get, { questionId: questionId as Id<"questions"> });
        if (!question) {
            return NextResponse.json({ error: "Question not found" }, { status: 404 });
        }
        if (String(question.testId) !== testId) {
            return NextResponse.json({ error: "Question does not belong to this test" }, { status: 400 });
        }

        const targetPieceId = await resolveTargetPiece(knowledgePieceId, test.knowledgePieceId);
        if (!targetPieceId) {
            return NextResponse.json({ error: "Missing knowledgePieceId for this test context." }, { status: 400 });
        }

        const pastMessages = await convex.query(api.testMessages.getForQuestion, {
            questionId: questionId as Id<"questions">,
            userId,
        });
        const conversationContext = pastMessages
            .map((m) => `${m.role === "user" ? "Student" : "AI Tutor"}: ${m.content}`)
            .join("\n") || "No prior conversation.";

        const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });
        const prompt = buildPrompt(
            question.question,
            question.answer ?? "N/A",
            question.userAnswer ?? "N/A",
            messageContent,
            conversationContext
        );

        const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
        const response = await ai.models.generateContent({ model, contents: prompt });
        const struggleNote = response.text?.trim() ?? "User had an issue with this topic.";

        await convex.mutation(api.knowledgeNodes.create, {
            spaceId: test.spaceId,
            knowledgePieceId: targetPieceId,
            type: "feels_hard",
            content: struggleNote,
        });

        await convex.mutation(api.deepDives.create, {
            userId,
            spaceId: test.spaceId,
            questionId: questionId as Id<"questions">,
            maxDives: limit,
        });


        return NextResponse.json({ success: true, note: struggleNote });
    } catch (err: unknown) {
        console.error("Feels-hard error:", err);
        const isAuthTokenError = err instanceof Error && err.message.includes("Missing Convex template token");
        if (isAuthTokenError) {
            return NextResponse.json({ error: "Unauthorized: Missing Convex auth token." }, { status: 401 });
        }
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
