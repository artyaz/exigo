import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: NextRequest) {
    try {
        const { spaceId, testType } = await req.json();

        if (!spaceId || !testType) {
            return NextResponse.json({ error: "Missing spaceId or testType" }, { status: 400 });
        }

        if (!process.env.GOOGLE_GEMINI_API_KEY) {
            return NextResponse.json({ error: "Server missing Gemini API key" }, { status: 500 });
        }

        const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });

        // Fetch pieces
        const pieces = await convex.query(api.knowledgePieces.getForSpace, { spaceId: spaceId as Id<"spaces"> });

        if (!pieces || pieces.length === 0) {
            return NextResponse.json({ error: "No knowledge pieces to test on." }, { status: 400 });
        }

        // Create a generating test record
        const testId = await convex.mutation(api.tests.create, { spaceId: spaceId as Id<"spaces">, type: testType });

        // Prepare prompt
        const knowledgeText = pieces.map(p => p.content).join("\n\n---\n\n");
        const prompt = `
      You are an expert educator. Create a knowledge test based ONLY on the following knowledge pieces.
      The test must have exactly 5 questions.
      The question type requested is: ${testType} ('select' means multiple choice, 'write' means open-ended).
      
      If 'select', provide exactly 4 options per question, and indicate the exactly complete answer string.
      If 'write', do not provide options, just provide a sample correct answer.
      
      Respond STRICTLY with a JSON array of objects, with no markdown formatting.
      Example 'select' format: [{"question":"...","options":["A","B","C","D"],"answer":"A"}]
      Example 'write' format: [{"question":"...","answer":"Correct open ended answer"}]
      
      Knowledge:
      ${knowledgeText}
    `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });

        try {
            const resultText = response.text;
            if (!resultText) throw new Error("No response from AI");
            const questionsData = JSON.parse(resultText);

            // Save each question to convex
            for (const q of questionsData) {
                await convex.mutation(api.questions.create, {
                    testId: testId,
                    type: testType,
                    question: q.question,
                    options: q.options || undefined,
                    answer: q.answer || undefined,
                });
            }

            // Mark the test as active
            await convex.mutation(api.tests.updateStatus, { testId, status: "active" });

            return NextResponse.json({ testId });

        } catch (parseError) {
            // Fallback
            console.error(parseError);
            await convex.mutation(api.tests.updateStatus, { testId, status: "draft" });
            return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
        }

    } catch (err: any) {
        console.error(err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
