import { query } from "./_generated/server";
import {
  DEEP_DIVE_LIMITS_BY_TIER,
  getDeepDiveLimitForTier,
} from "../shared/planConfig";
import {
  getLimitsForAccessLevel,
  getActiveSubscription,
  ACCESS_LEVELS,
  type PlanLimits,
} from "./subscriptionService";
import { getAuthedContext } from "./authDecorators";

export type ServerPlanLimits = PlanLimits;

export { DEEP_DIVE_LIMITS_BY_TIER, getDeepDiveLimitForTier };
export type { PlanLimits };

export const getSubscriptionInfo = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const subscription = await getActiveSubscription(ctx, identity.subject);
    if (!subscription) return null;

    return {
      planSlug: subscription.planSlug ?? null,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd ?? null,
    };
  },
});

export const getPlan = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        tier: "free",
        limits: getLimitsForAccessLevel(ACCESS_LEVELS.FREE),
        features: {
          conversational_ai: false,
          deep_dive_limit: getDeepDiveLimitForTier("free"),
        },
      };
    }

    const auth = await getAuthedContext(ctx);
    const { accessLevel, limits } = auth;

    const isPro = accessLevel >= ACCESS_LEVELS.PRO_SCHOLAR;

    let tier: "free" | "pro" | "educator" = "free";
    if (accessLevel === ACCESS_LEVELS.EDUCATOR) {
      tier = "educator";
    } else if (accessLevel === ACCESS_LEVELS.PRO_SCHOLAR) {
      tier = "pro";
    }

    return {
      tier,
      limits,
      features: {
        conversational_ai: isPro,
        deep_dive_limit: limits.deepDiveLimit,
      },
    };
  },
});
