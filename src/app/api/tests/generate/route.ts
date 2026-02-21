import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: NextRequest) {
    try {
        const rawBody = await req.json() as Record<string, unknown>;
        const spaceId = rawBody.spaceId as string;
        const testType = rawBody.testType as string;

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
            const parsedJson = JSON.parse(resultText) as unknown;
            if (!Array.isArray(parsedJson)) throw new Error("AI returned non-array");

            // Save test and questions transactionally
            const testId = await convex.mutation(api.tests.createWithQuestions, {
                spaceId: spaceId as Id<"spaces">,
                type: testType,
                questions: parsedJson.map((q: unknown) => {
                    const qObj = q as { question: string, options?: string[], answer?: string };
                    return {
                        type: testType,
                        question: qObj.question,
                        options: qObj.options ?? undefined,
                        answer: qObj.answer ?? undefined,
                    };
                }),
            });

            return NextResponse.json({ testId });

        } catch (parseError) {
            console.error(parseError);
            return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
        }

    } catch (err: unknown) {
        console.error(err);
        const errorMessage = err instanceof Error ? err.message : undefined;
        return NextResponse.json({ error: errorMessage ?? "Unknown error" }, { status: 500 });
    }
}
