import type { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;
function getGoogleAI() {
    if (!aiInstance) {
        if (!process.env.GOOGLE_GEMINI_API_KEY) throw new Error("Missing API Key");
        aiInstance = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });
    }
    return aiInstance;
}

/**
 * Generates a short title for a knowledge piece based on its content.
 */
export async function POST(req: NextRequest) {
    const { content } = await req.json() as { content: string };

    if (!content?.trim() || !process.env.GOOGLE_GEMINI_API_KEY) {
        return new Response(JSON.stringify({ error: "Missing content or API key" }), { status: 400 });
    }

    try {
        const ai = getGoogleAI();
        const result = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Generate a very short title (2-5 words, no quotes) that describes the main topic of this knowledge piece:\n\n${content.slice(0, 2000)}`,
            config: {
                maxOutputTokens: 20,
            },
        });
        /* eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing */
        const title = result.text?.trim().replaceAll(/(?:^["']|["']$)/g, '') || "Untitled";
        return new Response(JSON.stringify({ title }));
    } catch (err) {
        console.error("Title generation error:", err);
        return new Response(JSON.stringify({ title: "Untitled" }));
    }
}
