import { query } from "./_generated/server";
import {
  getEffectiveAccessLevel,
  ACCESS_LEVELS,
  getLimitsForAccessLevel,
  getAccessLevelName,
} from "./subscriptionService";

const isDebugEnabled =
  process.env.ENABLE_DEBUG_PLAN === "true" ||
  process.env.NODE_ENV !== "production";

function hashId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 4)}...${id.slice(-4)}` : id;
}

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

    return {
      enabled: true,
      authenticated: true,
      userId: hashId(userId),
      effective: {
        accessLevel,
        accessLevelName: getAccessLevelName(accessLevel),
        limits,
      },
    };
  },
});
