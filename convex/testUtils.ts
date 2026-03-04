import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import {
  getLimitsForAccessLevel,
  parseSlugToAccessLevel,
} from "./subscriptionService";
import { UNLIMITED_LIMIT } from "../shared/planConfig";

const ACCESS_LEVEL = v.union(v.literal(0), v.literal(1), v.literal(2));

export const createSpaceWithMockIdentity = internalMutation({
  args: { name: v.string(), userId: v.string(), mockTier: v.string() },
  handler: async (ctx, args) => {
    const accessLevel = parseSlugToAccessLevel(args.mockTier);
    const limits = getLimitsForAccessLevel(accessLevel);

    const existingSubscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!existingSubscription) {
      await ctx.db.insert("subscriptions", {
        userId: args.userId,
        accessLevel,
        status: "active",
      });
    } else {
      await ctx.db.patch(existingSubscription._id, {
        accessLevel,
        status: "active",
      });
    }

    const spaces = await ctx.db
      .query("spaces")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const limit = limits.maxSpaces;

    if (limit !== UNLIMITED_LIMIT && spaces.length >= limit) {
      throw new Error(
        `Limit reached: You can only have ${limit} spaces on your current plan.`,
      );
    }

    return await ctx.db.insert("spaces", {
      name: args.name,
      userId: args.userId,
    });
  },
});

export const setSubscriptionForTest = internalMutation({
  args: {
    userId: v.string(),
    accessLevel: ACCESS_LEVEL,
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("canceled"),
        v.literal("past_due"),
        v.literal("expired"),
      ),
    ),
    periodEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existingSubscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!existingSubscription) {
      return await ctx.db.insert("subscriptions", {
        userId: args.userId,
        accessLevel: args.accessLevel,
        status: args.status ?? "active",
        currentPeriodEnd: args.periodEnd,
      });
    } else {
      await ctx.db.patch(existingSubscription._id, {
        accessLevel: args.accessLevel,
        status: args.status ?? "active",
        currentPeriodEnd: args.periodEnd,
      });
      return existingSubscription._id;
    }
  },
});

export const getSubscriptionForTest = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});
