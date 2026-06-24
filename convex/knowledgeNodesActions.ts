"use node";
/* Node-runtime actions for knowledgeNodes. These pull in @google/genai and
   posthog-node (which use Node built-ins like node:fs), so per Convex's
   runtime rules they must live in a "use node" file containing ONLY actions —
   keeping them out of knowledgeNodes.ts is what lets `convex codegen` bundle
   the deterministic functions. The queries/mutations stay in knowledgeNodes.ts;
   this calls them via internal references. */
import { v } from "convex/values";
import { action } from "./_generated/server";
import { GoogleGenAI } from "@google/genai";
import { internal } from "./_generated/api";
import { getAuthedContextForAction, requireEducatorAccess } from "./authDecorators";
import {
  captureAiGenerationEvent,
  createAiTraceId,
  getPosthogClient,
} from "../shared/posthogAiObservability";

const FALLBACK_IMPROVEMENT =
  "Explore advanced edge cases and nuanced trade-offs in this topic.";

export const generateImprovements = action({
  args: {
    knowledgePieceId: v.id("knowledgePieces"),
    testId: v.id("tests"),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthedContextForAction(ctx);
    requireEducatorAccess(auth);

    const pieceData = await ctx.runQuery(
      internal.knowledgeNodes.getPieceDataInternal,
      {
        knowledgePieceId: args.knowledgePieceId,
        userId: auth.userId,
      },
    );

    if (!pieceData) {
      throw new Error("Knowledge piece not found or unauthorized");
    }

    const prompt = `You are an expert educator. The student just performed very well on a test about the following topic.
Your goal is to identify ONE specific, advanced, or "harder" concept within this text that the student should focus on next to deepen their understanding.

Text:
${pieceData.content}

Generate a concise 1-sentence description of the advanced concept they should focus on. Keep it under 25 words. Do not use markdown like bolding.`;

    let improvementIdea = FALLBACK_IMPROVEMENT;
    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      console.warn(
        "knowledgeNodes.generateImprovements: GOOGLE_GEMINI_API_KEY is missing; using fallback improvement.",
      );
    } else {
      try {
        const ai = new GoogleGenAI({
          apiKey: process.env.GOOGLE_GEMINI_API_KEY,
        });
        const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
        const startedAt = Date.now();
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
        });
        captureAiGenerationEvent({
          distinctId: auth.userId,
          traceId: createAiTraceId(),
          provider: "google",
          model,
          input: [{ role: "user", content: prompt }],
          response,
          latencySeconds: (Date.now() - startedAt) / 1000,
        });
        improvementIdea = response.text?.trim() ?? FALLBACK_IMPROVEMENT;
      } catch (error) {
        console.error(
          "knowledgeNodes.generateImprovements: Gemini request failed; using fallback improvement.",
          error,
        );
        const posthog = getPosthogClient();
        if (posthog) {
          posthog.capture({
            distinctId: auth.userId,
            event: "ai_generation_failed",
            properties: {
              source: "knowledgeNodes.generateImprovements",
              error_message: error instanceof Error ? error.message : String(error),
              error_name: error instanceof Error ? error.name : "UnknownError",
              model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
              knowledgePieceId: args.knowledgePieceId,
              usedFallback: true,
            },
          });
        }
      }
    }

    await ctx.runMutation(internal.knowledgeNodes.createInternal, {
      spaceId: pieceData.spaceId,
      knowledgePieceId: args.knowledgePieceId,
      type: "improvement",
      content: improvementIdea,
    });
  },
});
