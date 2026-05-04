import { query } from "./_generated/server";
import {
  getEffectiveAccessLevel,
  getLimitsForAccessLevel,
  getAccessLevelName,
} from "./subscriptionService";
import { hashId } from "../shared/hashId";

const isDebugEnabled =
  process.env.ENABLE_DEBUG_PLAN === "true" ||
  process.env.NODE_ENV !== "production";

export const debugPlan = query({
  args: {},
  handler: async (ctx) => {
    if (!isDebugEnabled) {
      return {
        enabled: false,
        message: "Debug endpoint disabled in production",
      };
    }

    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      return {
        enabled: true,
        authenticated: false,
        message: "Not authenticated",
      };
    }

    const userId = identity.subject;

    const accessLevel = await getEffectiveAccessLevel(ctx, userId);
    const limits = getLimitsForAccessLevel(accessLevel);

    // Read subscription from Convex
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return {
      enabled: true,
      authenticated: true,
      userId: hashId(userId),
      effective: {
        accessLevel,
        accessLevelName: getAccessLevelName(accessLevel),
        limits,
      },
      subscription: subscription
        ? {
            planSlug: subscription.planSlug,
            status: subscription.status,
            paddleSubscriptionId: subscription.paddleSubscriptionId
              ? hashId(subscription.paddleSubscriptionId)
              : null,
            currentPeriodEnd: subscription.currentPeriodEnd,
          }
        : null,
    };
  },
});
