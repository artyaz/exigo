import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { getAuthenticatedUserId, getAuthenticatedUserIdForAction } from "./auth";
import { hasFeature, isProPlan } from "./planLimits";

// ...

export const create = mutation({
    args: {
        spaceId: v.id("spaces"),
        knowledgePieceId: v.id("knowledgePieces"),
        type: v.union(v.literal("struggle"), v.literal("improvement"), v.literal("feels_hard")),
        content: v.string(),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthenticatedUserId(ctx);
        if (!userId) {
            throw new Error("Unauthorized access");
        }

        const identity = await ctx.auth.getUserIdentity();
        if (!isProPlan(identity)) {
            const keys = identity ? Object.keys(identity).filter(k => !k.startsWith("_")).join(", ") : "none";
            const planVal = String((identity as any)?.plan || (identity as any)?.publicMetadata?.plan || "none");
            throw new Error(`Knowledge Nodes require a Pro plan. Detected Plan: "${planVal}". Available Claims: [${keys}]. Please upgrade or refresh.`);
        }

        const space = await ctx.db.get(args.spaceId);
        if (!space || (space.userId !== userId && space.userId !== "default_user")) {
            throw new Error("Unauthorized access to this space");
        }

        return await ctx.db.insert("knowledgeNodes", {
            spaceId: args.spaceId,
            knowledgePieceId: args.knowledgePieceId,
            type: args.type,
            content: args.content,
            resolutionScore: 0,
            isActive: true,
        });
    },
});

export const resolve = mutation({
    args: {
        id: v.id("knowledgeNodes"),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthenticatedUserId(ctx);
        if (!userId) {
            throw new Error("Unauthorized access");
        }

        const identity = await ctx.auth.getUserIdentity();
        if (!isProPlan(identity)) {
            throw new Error("Knowledge Nodes require a Pro plan. Please upgrade.");
        }

        const node = await ctx.db.get(args.id);
        if (!node) {
            throw new Error("Knowledge node not found");
        }

        const space = await ctx.db.get(node.spaceId);
        if (!space || (space.userId !== userId && space.userId !== "default_user")) {
            throw new Error("Unauthorized access to this knowledge node");
        }

        if (!node.isActive) {
            return; // Already resolved
        }

        const newScore = Math.min(100, node.resolutionScore + 30);
        const isActive = newScore < 90;

        await ctx.db.patch(args.id, {
            resolutionScore: newScore,
            isActive,
        });

        return { newScore, isActive };
    },
});

export const getActiveForPiece = query({
    args: {
        knowledgePieceId: v.id("knowledgePieces"),
    },
    handler: async (ctx, args) => {
        // Absolute minimum query for debugging
        const nodes = await ctx.db
            .query("knowledgeNodes")
            .withIndex("by_piece", (q) => q.eq("knowledgePieceId", args.knowledgePieceId))
            .collect();

        return nodes;
    },
});

import { action } from "./_generated/server";
import { GoogleGenAI } from "@google/genai";
import { internal } from "./_generated/api";

export const createInternal = internalMutation({
    args: {
        spaceId: v.id("spaces"),
        knowledgePieceId: v.id("knowledgePieces"),
        type: v.union(v.literal("struggle"), v.literal("improvement"), v.literal("feels_hard")),
        content: v.string(),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("knowledgeNodes", {
            spaceId: args.spaceId,
            knowledgePieceId: args.knowledgePieceId,
            type: args.type,
            content: args.content,
            resolutionScore: 0,
            isActive: true,
        });
    }
});


export const generateImprovements = action({
    args: {
        knowledgePieceId: v.id("knowledgePieces"),
        testId: v.id("tests"),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthenticatedUserIdForAction(ctx);
        if (!userId) {
            throw new Error("Unauthorized access");
        }

        // Action cannot easily use ctx.db to check ownership unless we query an internal mutation/query.
        // Let's create an internal query to fetch stuff safely for Actions.
        const pieceData = await ctx.runQuery(internal.knowledgeNodes.getPieceDataInternal, {
            knowledgePieceId: args.knowledgePieceId,
            userId,
        });

        if (!pieceData) {
            throw new Error("Knowledge piece not found or unauthorized");
        }

        if (!process.env.GOOGLE_GEMINI_API_KEY) {
            throw new Error("Server missing Gemini API key");
        }

        const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });
        const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

        const prompt = `You are an expert educator. The student just performed very well on a test about the following topic.
Your goal is to identify ONE specific, advanced, or "harder" concept within this text that the student should focus on next to deepen their understanding.

Text:
${pieceData.content}

Generate a concise 1-sentence description of the advanced concept they should focus on. Keep it under 25 words. Do not use markdown like bolding.`;

        const response = await ai.models.generateContent({ model, contents: prompt });
        const improvementIdea = response.text?.trim() ?? "Explore advanced edge cases of this topic.";

        // Save it using an internal mutation since we verified ownership above
        await ctx.runMutation(internal.knowledgeNodes.createInternal, {
            spaceId: pieceData.spaceId,
            knowledgePieceId: args.knowledgePieceId,
            type: "improvement",
            content: improvementIdea,
        });
    },
});

export const getPieceDataInternal = internalQuery({
    args: {
        knowledgePieceId: v.id("knowledgePieces"),
        userId: v.string(),
    },
    handler: async (ctx, args) => {
        const piece = await ctx.db.get(args.knowledgePieceId);
        if (!piece) return null;
        const space = await ctx.db.get(piece.spaceId);
        if (!space || (space.userId !== args.userId && space.userId !== "default_user")) {
            return null;
        }
        return piece;
    }
});
