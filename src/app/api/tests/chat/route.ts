import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Handle a POST chat request: validate inputs, persist the user's message, generate an AI tutor reply using Google Gemini, persist the AI reply, and return the AI response.
 *
 * @returns A NextResponse containing `{ success: true, aiResponseText }` on success, or `{ error: string }` with an appropriate HTTP status (`400` for bad input, `404` if the question is missing, `500` for server errors) on failure.
 */
export async function POST(req: NextRequest) {
    try {
        const rawBody = await req.json() as Record<string, unknown>;
        const testId = rawBody.testId as string | undefined;
        const questionId = rawBody.questionId as string | undefined;
        const message = rawBody.message as string | undefined;

        if (!testId || !questionId || !message) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        if (!process.env.GOOGLE_GEMINI_API_KEY) {
            return NextResponse.json({ error: "Server missing Gemini API key" }, { status: 500 });
        }

        // 1. Fetch Question details for context
        const question = await convex.query(api.questions.get, { questionId: questionId as Id<"questions"> });
        if (!question) {
            return NextResponse.json({ error: "Question not found" }, { status: 404 });
        }

        // Verify question belongs to the specified test
        if (String(question.testId) !== testId) {
            return NextResponse.json({ error: "Question does not belong to this test" }, { status: 400 });
        }

        // 2. Fetch past messages for this question to maintain conversation history
        const pastMessages = await convex.query(api.testMessages.getForQuestion, { questionId: questionId as Id<"questions"> });

        // 3. Save User Message to DB
        await convex.mutation(api.testMessages.send, {
            testId: testId as Id<"tests">,
            questionId: questionId as Id<"questions">,
            role: "user",
            content: message,
        });

        // 4. Construct Gemini Prompt
        const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });

        let historyPrompt = "";
        if (pastMessages.length > 0) {
            historyPrompt = "\nPrevious conversation about this question:\n" + pastMessages.map(m => `${m.role === 'user' ? 'Student' : 'You'}: ${m.content}`).join('\n') + "\nStudent: " + message;
        } else {
            historyPrompt = `\nStudent: ${message}`;
        }

        const prompt = `
        You are a helpful, brilliant, and patient AI tutor. A student is reviewing a test question and has a follow-up question for you.

        [Context Information]
        Question: ${question.question}
        Perfect Answer Outline: ${question.answer ?? 'N/A'}
        Student's Given Answer: ${question.userAnswer ?? 'N/A'}
        Correct?: ${question.isCorrect ? 'Yes' : 'No'}
        Your Initial Feedback: ${question.aiFeedback ?? 'N/A'}
        
        [Conversation]${historyPrompt}

        Respond directly and concisely to the student's latest message. Be encouraging but highly accurate. Format your response in plain text or simple markdown.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: prompt,
        });

        const aiResponseText = response.text ?? "I'm sorry, I couldn't formulate a response.";

        // 5. Save AI Message to DB
        await convex.mutation(api.testMessages.send, {
            testId: testId as Id<"tests">,
            questionId: questionId as Id<"questions">,
            role: "ai",
            content: aiResponseText,
        });

        return NextResponse.json({ success: true, aiResponseText });

    } catch (err: unknown) {
        console.error(err);
        const errorMessage = err instanceof Error ? err.message : undefined;
        return NextResponse.json({ error: errorMessage ?? "Unknown error" }, { status: 500 });
    }
}