import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("spaces")
            .filter((q) => q.eq(q.field("userId"), args.userId))
            .collect();
    },
});

export const countForUser = query({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        const spaces = await ctx.db
            .query("spaces")
            .filter((q) => q.eq(q.field("userId"), args.userId))
            .collect();
        return spaces.length;
    },
});

export const get = query({
    args: { spaceId: v.id("spaces") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.spaceId);
    },
});

export const create = mutation({
    args: { name: v.string(), userId: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db.insert("spaces", { name: args.name, userId: args.userId });
    },
});
