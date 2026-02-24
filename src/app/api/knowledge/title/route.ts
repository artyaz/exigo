import type { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;
function getGoogleAI() {
    if (!aiInstance) {
        if (!process.env.GOOGLE_GEMINI_API_KEY) {
            throw new Error("Missing API Key");
        }
        aiInstance = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });
    }
    return aiInstance;
}

function normalizeTitle(raw: string): string {
    return raw
        .replaceAll(/[\n\r]+/g, " ")
        .replaceAll(/^["'`\s]+|["'`\s]+$/g, "")
        .replaceAll(/[.?!,:;]+$/g, "")
        .trim();
}

function fallbackTitleFromContent(content: string): string {
    const cleaned = content
        .replaceAll(/[\n\r]+/g, " ")
        .replaceAll(/\s+/g, " ")
        .replaceAll(/[`*_#>\[\]{}()]/g, "")
        .trim();

    if (!cleaned) return "Untitled";

    const firstSentence = cleaned.split(/[.!?]/)[0]?.trim() ?? cleaned;
    const words = firstSentence
        .split(/\s+/)
        .map((word) => word.replaceAll(/[^a-zA-Z0-9-]/g, ""))
        .filter(Boolean)
        .slice(0, 5);

    return words.length > 0 ? words.join(" ") : "Untitled";
}

/**
 * Generates a short title for a knowledge piece based on its content.
 */
export async function POST(req: NextRequest) {
    const { content } = await req.json() as { content: string };

    if (!content?.trim()) {
        return new Response(JSON.stringify({ error: "Missing content" }), { status: 400 });
    }

    const fallbackTitle = fallbackTitleFromContent(content);

    if (!process.env.GOOGLE_GEMINI_API_KEY) {
        return new Response(JSON.stringify({ title: fallbackTitle }));
    }

    const modelCandidates = [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
    ] as const;

    try {
        const ai = getGoogleAI();

        for (const model of modelCandidates) {
            try {
                const result = await ai.models.generateContent({
                    model,
                    contents: `Generate a concise title (2-5 words, no quotes) for this knowledge note.\n\n${content.slice(0, 2000)}`,
                    config: {
                        maxOutputTokens: 20,
                        temperature: 0.2,
                    },
                });

                const candidate = normalizeTitle(result.text ?? "");
                if (!candidate) {
                    continue;
                }

                const words = candidate.split(/\s+/).filter(Boolean);
                if (words.length >= 2 && words.length <= 8) {
                    return new Response(JSON.stringify({ title: candidate }));
                }
            } catch {
                // Try next model.
            }
        }

        return new Response(JSON.stringify({ title: fallbackTitle }));
    } catch (err) {
        console.error("Title generation error:", err);
        return new Response(JSON.stringify({ title: fallbackTitle }));
    }
}
