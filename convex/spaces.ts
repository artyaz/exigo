import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getServerPlanLimitsForUser } from "./planLimits";
import { UNLIMITED_LIMIT } from "../shared/planConfig";

export const list = query({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const authenticatedUserId = identity?.subject;
        if (!authenticatedUserId || authenticatedUserId !== args.userId) {
            return [];
        }

        return await ctx.db
            .query("spaces")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .collect();
    },
});

export const countForUser = query({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const authenticatedUserId = identity?.subject;
        if (!authenticatedUserId || authenticatedUserId !== args.userId) {
            return 0;
        }

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
        const identity = await ctx.auth.getUserIdentity();
        const authenticatedUserId = identity?.subject;
        if (!authenticatedUserId || authenticatedUserId !== args.userId) {
            return null;
        }

        const space = await ctx.db.get(args.spaceId);
        if (!space || space.userId !== args.userId) return null;
        return space;
    },
});

export const create = mutation({
    args: { name: v.string(), userId: v.string() },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const authenticatedUserId = identity?.subject;
        
        if (!authenticatedUserId) {
            throw new Error("Unauthorized: No identity found in Convex.");
        }
        
        if (authenticatedUserId !== args.userId) {
            throw new Error(`Unauthorized: Identity mismatch. Auth: ${authenticatedUserId}, Args: ${args.userId}`);
        }

        const spaces = await ctx.db
            .query("spaces")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .collect();
        const currentCount = spaces.length;

        const serverLimit = getServerPlanLimitsForUser(args.userId, identity).maxSpaces;
        
        console.log(`[Space Creation] User: ${args.userId}, Tier Limit: ${serverLimit}, Current Count: ${currentCount}`);

        if (serverLimit !== UNLIMITED_LIMIT && currentCount >= serverLimit) {
            throw new Error(`Limit reached: You can only have ${serverLimit} spaces on your current plan.`);
        }

        return await ctx.db.insert("spaces", { name: args.name, userId: args.userId });
    },
});
