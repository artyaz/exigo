import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getServerPlanLimitsForUser } from "./planLimits";

/**
 * TEST ONLY: This mutation is used by integration tests to simulate a specific plan 
 * without needing real Clerk auth tokens.
 */
export const createSpaceWithMockIdentity = internalMutation({
    args: { name: v.string(), userId: v.string(), mockTier: v.string() },
    handler: async (ctx, args) => {
        // We simulate the identity object that getServerPlanLimitsForUser expects
        const mockIdentity = {
            subject: args.userId,
            publicMetadata: { plan: args.mockTier }
        };

        const spaces = await ctx.db
            .query("spaces")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .collect();
        
        const limits = getServerPlanLimitsForUser(args.userId, mockIdentity);
        const limit = limits.maxSpaces;

        if (limit !== Infinity && spaces.length >= limit) {
            throw new Error(`Limit reached: You can only have ${limit} spaces on your current plan.`);
        }

        return await ctx.db.insert("spaces", { name: args.name, userId: args.userId });
    },
});
