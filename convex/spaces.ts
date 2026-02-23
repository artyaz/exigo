import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getServerPlanLimitsForUser } from "./planLimits";

export const list = query({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("spaces")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .collect();
    },
});

export const countForUser = query({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        const spaces = await ctx.db
            .query("spaces")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .collect();
        return spaces.length;
    },
});

export const get = query({
    args: { spaceId: v.id("spaces"), userId: v.string() },
    handler: async (ctx, args) => {
        const space = await ctx.db.get(args.spaceId);
        if (!space || (space.userId !== args.userId && space.userId !== "default_user")) return null;
        return space;
    },
});

export const create = mutation({
    args: { name: v.string(), userId: v.string() },
    handler: async (ctx, args) => {
        const spaces = await ctx.db
            .query("spaces")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .collect();
        const currentCount = spaces.length;

        const serverLimit = getServerPlanLimitsForUser(args.userId).maxSpaces;
        if (currentCount >= serverLimit) {
            throw new Error(`Limit reached: You can only have ${serverLimit} spaces on your current plan.`);
        }

        return await ctx.db.insert("spaces", { name: args.name, userId: args.userId });
    },
});
