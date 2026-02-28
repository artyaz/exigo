import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

function hashId(id: string): string {
  if (id.length > 8) return `${id.slice(0, 4)}...${id.slice(-4)}`;
  if (id.length >= 4) return `${id.slice(0, 2)}...${id.slice(-2)}`;
  return "*".repeat(id.length);
}

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
    console.log("[Subscription] Inserting subscription record", {
      userId: hashId(args.userId),
      accessLevel: args.accessLevel,
      status: args.status,
      periodEnd: args.periodEnd,
    });

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
      .collect();
  },
});
