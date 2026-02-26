import { query } from "./_generated/server";
import {
  getEffectiveAccessLevel,
  ACCESS_LEVELS,
  getLimitsForAccessLevel,
} from "./subscriptionService";

export const debugPlan = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      return {
        authenticated: false,
        message: "Not authenticated",
      };
    }

    const userId = identity.subject;

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const accessLevel = await getEffectiveAccessLevel(ctx, userId);
    const limits = getLimitsForAccessLevel(accessLevel);

    return {
      authenticated: true,
      userId,
      identity: {
        subject: identity.subject,
        publicMetadata: identity.publicMetadata,
      },
      subscription: subscription
        ? {
            _id: subscription._id,
            accessLevel: subscription.accessLevel,
            status: subscription.status,
            clerkPlanSlug: subscription.clerkPlanSlug,
            periodEnd: subscription.periodEnd,
          }
        : null,
      effective: {
        accessLevel,
        accessLevelName:
          accessLevel === ACCESS_LEVELS.EDUCATOR
            ? "educator"
            : accessLevel === ACCESS_LEVELS.PRO_SCHOLAR
              ? "pro_scholar"
              : "free",
        limits,
      },
    };
  },
});
