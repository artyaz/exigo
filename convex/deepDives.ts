import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
    args: {
        userId: v.string(),
        spaceId: v.id("spaces"),
        questionId: v.id("questions"),
        maxDives: v.number(),
    },
    handler: async (ctx, args) => {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const dives = await ctx.db
            .query("deepDives")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .filter((q) => q.gte(q.field("_creationTime"), startOfMonth.getTime()))
            .collect();

        if (dives.length >= args.maxDives) {
            throw new Error(`Limit reached: You can only generate ${args.maxDives} Deep Dive notes per month on your current plan.`);
        }

        return await ctx.db.insert("deepDives", {
            userId: args.userId,
            spaceId: args.spaceId,
            questionId: args.questionId,
        });
    },
});


export const countForUserThisMonth = query({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const dives = await ctx.db
            .query("deepDives")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .filter((q) => q.gte(q.field("_creationTime"), startOfMonth.getTime()))
            .collect();

        return dives.length;
    },
});
