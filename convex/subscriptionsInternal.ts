import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const upsert = internalMutation({
  args: {
    userId: v.string(),
    accessLevel: v.number(),
    clerkPlanId: v.optional(v.string()),
    clerkPlanSlug: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("canceled"),
      v.literal("past_due"),
      v.literal("expired"),
    ),
    periodEnd: v.optional(v.number()),
    canceledAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        accessLevel: args.accessLevel,
        clerkPlanId: args.clerkPlanId,
        clerkPlanSlug: args.clerkPlanSlug,
        status: args.status,
        periodEnd: args.periodEnd,
        canceledAt: args.canceledAt,
      });
      return existing._id;
    }

    return await ctx.db.insert("subscriptions", {
      userId: args.userId,
      accessLevel: args.accessLevel,
      clerkPlanId: args.clerkPlanId,
      clerkPlanSlug: args.clerkPlanSlug,
      status: args.status,
      periodEnd: args.periodEnd,
      canceledAt: args.canceledAt,
    });
  },
});

export const getForUser = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});
