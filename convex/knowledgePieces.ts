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
        content: v.string(),
        source: v.optional(v.string())
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("knowledgePieces", {
            spaceId: args.spaceId,
            content: args.content,
            source: args.source,
        });
    },
});

export const bulkImport = mutation({
    args: {
        spaceId: v.id("spaces"),
        pieces: v.array(
            v.object({
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
                content: piece.content,
                source: piece.source,
            });
            ids.push(id);
        }
        return ids;
    },
});
