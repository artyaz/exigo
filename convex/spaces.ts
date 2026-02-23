import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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
    args: { name: v.string(), userId: v.string(), maxSpaces: v.number() },
    handler: async (ctx, args) => {
        const counters = await ctx.db
            .query("spaceCounters")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .collect();
        const existingCounter = counters[0];

        let currentCount = existingCounter?.count ?? 0;
        if (!existingCounter) {
            const spaces = await ctx.db
                .query("spaces")
                .withIndex("by_user", (q) => q.eq("userId", args.userId))
                .collect();
            currentCount = spaces.length;
        }

        if (currentCount >= args.maxSpaces) {
            throw new Error(`Limit reached: You can only have ${args.maxSpaces} spaces on your current plan.`);
        }

        const spaceId = await ctx.db.insert("spaces", { name: args.name, userId: args.userId });

        if (existingCounter) {
            await ctx.db.patch(existingCounter._id, { count: currentCount + 1 });
        } else {
            await ctx.db.insert("spaceCounters", {
                userId: args.userId,
                count: currentCount + 1,
            });
        }

        return spaceId;
    },
});
