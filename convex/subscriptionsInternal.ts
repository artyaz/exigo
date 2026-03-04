import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import type { GenericQueryCtx } from "convex/server";
import type { DataModel } from "./_generated/dataModel";

function hashId(id: string): string {
  if (id.length > 8) return `${id.slice(0, 4)}...${id.slice(-4)}`;
  if (id.length >= 4) return `${id.slice(0, 2)}...${id.slice(-2)}`;
  return "*".repeat(id.length);
}

async function findByPaddleSubId(
  ctx: GenericQueryCtx<DataModel>,
  paddleSubscriptionId: string,
) {
  return ctx.db
    .query("subscriptions")
    .withIndex("by_paddle_sub", (q) =>
      q.eq("paddleSubscriptionId", paddleSubscriptionId),
    )
    .first();
}

export const upsertFromPaddle = internalMutation({
  args: {
    userId: v.string(),
    accessLevel: v.number(),
    planSlug: v.optional(v.string()),
    paddleSubscriptionId: v.string(),
    paddleCustomerId: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("canceled"),
      v.literal("past_due"),
      v.literal("expired"),
      v.literal("paused"),
    ),
    currentPeriodStart: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    canceledAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    console.log("[Subscription] Upserting from Paddle", {
      userId: hashId(args.userId),
      accessLevel: args.accessLevel,
      status: args.status,
      paddleSubscriptionId: hashId(args.paddleSubscriptionId),
    });

    const existing = await findByPaddleSubId(ctx, args.paddleSubscriptionId);

    if (existing) {
      if (existing.userId !== args.userId) {
        console.warn("[Subscription] userId mismatch on existing subscription", {
          existingUserId: hashId(existing.userId),
          incomingUserId: hashId(args.userId),
          paddleSubscriptionId: hashId(args.paddleSubscriptionId),
        });
      }

      await ctx.db.patch(existing._id, {
        accessLevel: args.accessLevel,
        planSlug: args.planSlug,
        paddleCustomerId: args.paddleCustomerId,
        status: args.status,
        currentPeriodStart: args.currentPeriodStart,
        currentPeriodEnd: args.currentPeriodEnd,
        canceledAt: args.canceledAt,
      });
      return existing._id;
    }

    return await ctx.db.insert("subscriptions", {
      userId: args.userId,
      accessLevel: args.accessLevel,
      planSlug: args.planSlug,
      paddleSubscriptionId: args.paddleSubscriptionId,
      paddleCustomerId: args.paddleCustomerId,
      status: args.status,
      currentPeriodStart: args.currentPeriodStart,
      currentPeriodEnd: args.currentPeriodEnd,
      canceledAt: args.canceledAt,
    });
  },
});

export const cancelFromPaddle = internalMutation({
  args: {
    paddleSubscriptionId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await findByPaddleSubId(ctx, args.paddleSubscriptionId);

    if (!existing) {
      console.warn(
        "[Subscription] Cancel: not found",
        hashId(args.paddleSubscriptionId),
      );
      return;
    }

    await ctx.db.patch(existing._id, {
      status: "canceled",
      canceledAt: Date.now(),
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
