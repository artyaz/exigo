import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getServerPlanLimitsForUser } from "./planLimits";
import { getAuthenticatedUserId } from "./auth";

export const getForSpace = query({
    args: { spaceId: v.id("spaces") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("knowledgePieces")
            .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
            .collect();
    },
});

export const add = mutation({
    args: {
        spaceId: v.id("spaces"),
        title: v.optional(v.string()),
        content: v.string(),
        source: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthenticatedUserId(ctx);
        if (!userId) {
            throw new Error("Unauthorized access to this space");
        }

        const space = await ctx.db.get(args.spaceId);
        if (!space || (space.userId !== userId && space.userId !== "default_user")) {
            throw new Error("Unauthorized access to this space");
        }

        const existingPieces = await ctx.db
            .query("knowledgePieces")
            .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
            .collect();

        const identity = await ctx.auth.getUserIdentity();
        const serverLimit = getServerPlanLimitsForUser(userId, identity).maxKnowledgePiecesPerSpace;
        const projectedTotal = existingPieces.length + 1;
        if (serverLimit !== Infinity && projectedTotal > serverLimit) {
            throw new Error(`Limit reached: You can only have ${serverLimit} knowledge pieces per space on your current plan.`);
        }

        return await ctx.db.insert("knowledgePieces", {
            spaceId: args.spaceId,
            title: args.title,
            content: args.content,
            source: args.source,
        });
    },
});


export const updateTitle = mutation({
    args: {
        id: v.id("knowledgePieces"),
        title: v.string(),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthenticatedUserId(ctx);
        if (!userId) {
            throw new Error("Unauthorized access to this space");
        }

        const piece = await ctx.db.get(args.id);
        if (!piece) {
            throw new Error(`Knowledge piece not found for id: ${args.id}`);
        }

        const space = await ctx.db.get(piece.spaceId);
        if (!space || (space.userId !== userId && space.userId !== "default_user")) {
            throw new Error("Unauthorized access to this knowledge piece");
        }

        await ctx.db.patch(args.id, { title: args.title });
    },
});


export const bulkImport = mutation({
    args: {
        spaceId: v.id("spaces"),
        pieces: v.array(
            v.object({
                title: v.optional(v.string()),
                content: v.string(),
                source: v.optional(v.string()),
            })
        ),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthenticatedUserId(ctx);
        if (!userId) {
            throw new Error("Unauthorized access to this space");
        }

        const space = await ctx.db.get(args.spaceId);
        if (!space || (space.userId !== userId && space.userId !== "default_user")) {
            throw new Error("Unauthorized access to this space");
        }

        const existingPieces = await ctx.db
            .query("knowledgePieces")
            .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
            .collect();

        const identity = await ctx.auth.getUserIdentity();
        const serverLimit = getServerPlanLimitsForUser(userId, identity).maxKnowledgePiecesPerSpace;
        const nonEmptyIncomingCount = args.pieces.filter((piece) => piece.content.trim() !== "").length;
        const projectedTotal = existingPieces.length + nonEmptyIncomingCount;
        if (serverLimit !== Infinity && projectedTotal > serverLimit) {
            throw new Error(`Limit reached: Bulk import would exceed the limit of ${serverLimit} knowledge pieces per space.`);
        }

        const ids = [];
        for (const piece of args.pieces) {
            if (piece.content.trim() === "") continue;
            const id = await ctx.db.insert("knowledgePieces", {
                spaceId: args.spaceId,
                title: piece.title,
                content: piece.content,
                source: piece.source,
            });
            ids.push(id);
        }
        return ids;
    },
});


export const appendContent = mutation({
    args: {
        id: v.id("knowledgePieces"),
        content: v.string(),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthenticatedUserId(ctx);
        if (!userId) {
            throw new Error("Unauthorized access to this space");
        }

        const piece = await ctx.db.get(args.id);
        if (!piece) {
            throw new Error(`Knowledge piece not found for id: ${args.id}`);
        }

        const space = await ctx.db.get(piece.spaceId);
        if (!space || (space.userId !== userId && space.userId !== "default_user")) {
            throw new Error("Unauthorized access to this knowledge piece");
        }

        await ctx.db.patch(args.id, {
            content: piece.content + "\n\n" + args.content,
        });
    },
});
