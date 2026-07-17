import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import type { GenericQueryCtx } from "convex/server";
import type { DataModel } from "./_generated/dataModel";
import { SUBSCRIPTION_STATUSES } from "../shared/subscriptionStatuses";
import { hashId } from "../shared/hashId";
import { slugToAccessLevel } from "../shared/planConfig";

const vSubscriptionStatus = v.union(
  ...SUBSCRIPTION_STATUSES.map((s) => v.literal(s)),
);

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
    /** Optional body value — ignored for entitlements; derived from planSlug. */
    accessLevel: v.optional(v.number()),
    planSlug: v.string(),
    paddleSubscriptionId: v.string(),
    paddleCustomerId: v.optional(v.string()),
    status: vSubscriptionStatus,
    currentPeriodStart: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    canceledAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Trust planSlug only — never caller-supplied accessLevel for entitlements.
    const accessLevel = slugToAccessLevel(args.planSlug);

    console.log("[Subscription] Upserting from Paddle", {
      userId: hashId(args.userId),
      planSlug: args.planSlug,
      accessLevel,
      status: args.status,
      paddleSubscriptionId: hashId(args.paddleSubscriptionId),
    });

    const existing = await findByPaddleSubId(ctx, args.paddleSubscriptionId);

    if (existing) {
      if (existing.userId !== args.userId) {
        // Fail closed: do not patch entitlements onto the original owner.
        console.warn(
          "[Subscription] userId mismatch on existing subscription — rejecting",
          {
            existingUserId: hashId(existing.userId),
            incomingUserId: hashId(args.userId),
            paddleSubscriptionId: hashId(args.paddleSubscriptionId),
          },
        );
        return {
          ok: false as const,
          reason: "userId_mismatch" as const,
        };
      }

      await ctx.db.patch(existing._id, {
        accessLevel,
        planSlug: args.planSlug,
        paddleCustomerId: args.paddleCustomerId,
        status: args.status,
        currentPeriodStart: args.currentPeriodStart,
        currentPeriodEnd: args.currentPeriodEnd,
        canceledAt: args.canceledAt,
      });
      return { ok: true as const, subscriptionId: existing._id };
    }

    const subscriptionId = await ctx.db.insert("subscriptions", {
      userId: args.userId,
      accessLevel,
      planSlug: args.planSlug,
      paddleSubscriptionId: args.paddleSubscriptionId,
      paddleCustomerId: args.paddleCustomerId,
      status: args.status,
      currentPeriodStart: args.currentPeriodStart,
      currentPeriodEnd: args.currentPeriodEnd,
      canceledAt: args.canceledAt,
    });
    return { ok: true as const, subscriptionId };
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
