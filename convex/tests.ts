import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
    args: { spaceId: v.id("spaces"), type: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db.insert("tests", {
            spaceId: args.spaceId,
            status: "generating",
            config: { type: args.type },
        });
    },
});

export const updateStatus = mutation({
    args: { testId: v.id("tests"), status: v.union(v.literal("draft"), v.literal("generating"), v.literal("active"), v.literal("completed")) },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.testId, { status: args.status });
    },
});

export const getForSpace = query({
    args: { spaceId: v.id("spaces") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("tests")
            .withIndex("by_space", (q: any) => q.eq("spaceId", args.spaceId))
            .collect();
    },
});

export const get = query({
    args: { testId: v.id("tests") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.testId);
    },
});
