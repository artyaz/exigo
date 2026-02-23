import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenAI } from "@google/genai";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * "Feels hard" endpoint: takes a chat message + question context, uses AI to
 * generate a concise struggle note ("User had an issue with ..."), then appends
 * that note to the knowledge piece that was used for this test.
 */
export async function POST(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!process.env.GOOGLE_GEMINI_API_KEY) {
            return NextResponse.json({ error: "Server missing Gemini API key" }, { status: 500 });
        }

        const rawBody = (await req.json()) as Record<string, unknown>;
        const testId = rawBody.testId as string | undefined;
        const questionId = rawBody.questionId as string | undefined;
        const messageContent = rawBody.messageContent as string | undefined;
        const knowledgePieceId = rawBody.knowledgePieceId as string | undefined;

        if (!testId || !questionId || !messageContent) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // 1. Fetch question context
        const question = await convex.query(api.questions.get, {
            questionId: questionId as Id<"questions">,
        });
        if (!question) {
            return NextResponse.json({ error: "Question not found" }, { status: 404 });
        }

        // 2. Fetch the test to get spaceId
        const test = await convex.query(api.tests.get, {
            testId: testId as Id<"tests">,
        });
        if (!test) {
            return NextResponse.json({ error: "Test not found" }, { status: 404 });
        }

        // 3. Verify space ownership
        const space = await convex.query(api.spaces.get, { spaceId: test.spaceId });
        if (!space || (space.userId !== userId && space.userId !== "default_user")) {
            return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
        }

        // 4. Determine the knowledge piece to append to
        let targetPieceId: Id<"knowledgePieces"> | null = null;

        if (knowledgePieceId) {
            targetPieceId = knowledgePieceId as Id<"knowledgePieces">;
        } else {
            // Fall back: pick the first knowledge piece in the space
            const pieces = await convex.query(api.knowledgePieces.getForSpace, {
                spaceId: test.spaceId,
            });
            if (pieces && pieces.length > 0 && pieces[0]) {
                targetPieceId = pieces[0]._id;
            }
        }

        if (!targetPieceId) {
            return NextResponse.json(
                { error: "No knowledge piece found to append to" },
                { status: 404 }
            );
        }

        // 5. Fetch conversation history for richer context
        const pastMessages = await convex.query(api.testMessages.getForQuestion, {
            questionId: questionId as Id<"questions">,
        });

        const conversationContext = pastMessages
            .map((m) => `${m.role === "user" ? "Student" : "AI Tutor"}: ${m.content}`)
            .join("\n");

        // 6. Use AI to generate the struggle note
        const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });

        const prompt = `You are an educational note-taker. A student interacted with an AI tutor while studying a test question and has flagged an AI explanation as "Feels hard" — meaning they struggled with the concept.

Based on the context below, generate a concise note (2-4 sentences) describing what the user struggled with and what specific concept needs reinforcement.

Format the note EXACTLY like this:
"User had an issue with understanding [topic]. Specifically, [describe the gap in understanding]. To improve, the user should focus on [specific recommendation]."

[Question]
${question.question}

[Correct Answer]
${question.answer ?? "N/A"}

[Student's Answer]
${question.userAnswer ?? "N/A"}

[AI Explanation that felt hard]
${messageContent}

[Full Conversation]
${conversationContext || "No prior conversation."}

Important:
- Output ONLY the note text. No markdown, no quotes, no extra formatting.
- Be specific about the concept, not generic.
- Keep it under 4 sentences.`;

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
        });

        const struggleNote = response.text?.trim() ?? "User had an issue with this topic.";

        // 7. Append the note to the knowledge piece
        await convex.mutation(api.knowledgePieces.appendContent, {
            id: targetPieceId,
            content: `---\n📌 Study Note (auto-generated): ${struggleNote}`,
        });

        return NextResponse.json({ success: true, note: struggleNote });
    } catch (err: unknown) {
        console.error("Feels-hard error:", err);
        const errorMessage = err instanceof Error ? err.message : undefined;
        return NextResponse.json(
            { error: errorMessage ?? "Unknown error" },
            { status: 500 }
        );
    }
}
