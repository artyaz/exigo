import type { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY! });

/**
 * Generates a short title for a knowledge piece based on its content.
 */
export async function POST(req: NextRequest) {
    const { content } = await req.json() as { content: string };

    if (!content?.trim() || !process.env.GOOGLE_GEMINI_API_KEY) {
        return new Response(JSON.stringify({ error: "Missing content or API key" }), { status: 400 });
    }

    try {
        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Generate a very short title (2-5 words, no quotes) that describes the main topic of this knowledge piece:\n\n${content.slice(0, 2000)}`,
            config: {
                maxOutputTokens: 20,
            },
        });
        const title = result.text?.trim().replace(/^["']|["']$/g, '') || "Untitled";
        return new Response(JSON.stringify({ title }));
    } catch (err) {
        console.error("Title generation error:", err);
        return new Response(JSON.stringify({ title: "Untitled" }));
    }
}
