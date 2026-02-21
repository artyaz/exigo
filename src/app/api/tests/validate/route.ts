import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Helper to securely validate incoming AI evaluation shape
 */
function validateAIResponse(result: unknown): { isCorrect: boolean; feedback: string } | null {
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
            feedback: (result as Record<string, unknown>).feedback as string
        };
    }
    return null;
}

export async function POST(req: NextRequest) {
    try {
        const rawBody = await req.json() as Record<string, unknown>;
        const questionId = rawBody.questionId as string | undefined;
        const answer = rawBody.answer as string | undefined;
        const testType = rawBody.testType as string | undefined;

        if (!questionId || !answer || !testType) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Validate active question directly

        const question = await convex.query(api.questions.get, { questionId: questionId as Id<"questions"> });
        if (!question) return NextResponse.json({ error: "Question not found" }, { status: 404 });

        let isCorrect = false;
        let aiFeedback = "Correct!";

        if (testType === "select") {
            isCorrect = answer === question.answer;
            aiFeedback = isCorrect ? "Correct answer!" : `Incorrect. The correct answer was: ${question.answer}`;
        } else if (testType === "write") {
            if (!process.env.GOOGLE_GEMINI_API_KEY) {
                return NextResponse.json({ error: "Server missing Gemini API key" }, { status: 500 });
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

            const response = await ai.models.generateContent({
                model: "gemini-2.0-flash",
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                }
            });

            try {
                const parsed = JSON.parse(response.text ?? "{}") as unknown;
                const validated = validateAIResponse(parsed);

                if (validated) {
                    isCorrect = validated.isCorrect;
                    aiFeedback = validated.feedback;
                } else {
                    isCorrect = false;
                    aiFeedback = "Failed to parse AI feedback format.";
                }
            } catch (e) {
                console.error(e);
                isCorrect = false;
                aiFeedback = "Failed to parse AI outcome.";
            }
        }

        // Update the question
        await convex.mutation(api.questions.updateFeedback, {
            questionId: questionId as Id<"questions">,
            isCorrect,
            aiFeedback,
            userAnswer: answer,
        });

        return NextResponse.json({ isCorrect, aiFeedback });

    } catch (err: unknown) {
        console.error(err);
        const errorMessage = err instanceof Error ? err.message : undefined;
        return NextResponse.json({ error: errorMessage ?? "Unknown error" }, { status: 500 });
    }
}
