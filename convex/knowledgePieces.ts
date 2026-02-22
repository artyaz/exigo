import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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
        const piece = await ctx.db.get(args.id);
        if (!piece) {
            throw new Error(`Knowledge piece not found for id: ${args.id}`);
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
