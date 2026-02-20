import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: NextRequest) {
    try {
        const { questionId, answer, testType } = await req.json();

        if (!questionId || !answer || !testType) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // fetch the question from convex
        // Wait, we don't have a getQuestion by id query. Let's add one or use a workaround.
        // Instead of adding getQuestion query right now, I know testType and question answer can be matched.
        // Actually, I need the question text and original correct answer to evaluate.
        // I can fetch all questions for the test... wait, I don't have testId.
        // I'll need to fetch the question directly. I'll add `getQuestion` to convex/questions.ts in a moment,
        // assuming it exists as `api.questions.get`

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
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                }
            });

            try {
                const result = JSON.parse(response.text || "{}");
                isCorrect = result.isCorrect;
                aiFeedback = result.feedback;
            } catch (e) {
                console.error(e);
                isCorrect = false;
                aiFeedback = "Failed to parse AI feedback.";
            }
        }

        // Update the question
        await convex.mutation(api.questions.updateFeedback, {
            questionId: questionId as Id<"questions">,
            isCorrect,
            aiFeedback,
            userAnswer: answer, // Wait, `updateFeedback` mutation currently takes `isCorrect` & `aiFeedback`. I need `answer` field saved as well.
        });

        return NextResponse.json({ isCorrect, aiFeedback });

    } catch (err: any) {
        console.error(err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
