import type { Doc } from "./_generated/dataModel";
import type { QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";
import type { SubscriptionStatus } from "../shared/subscriptionStatuses";
import {
  PLAN_LIMIT_CODE,
  UNLIMITED_LIMIT,
  LIMITS_BY_TIER,
  getLimitsForTier,
  slugToTier,
  tierToAccessLevel,
  type PlanLimits,
  type PlanTier,
} from "../shared/planConfig";

export type { PlanLimits, PlanTier };

export const ACCESS_LEVELS = {
  FREE: 0,
  PRO_SCHOLAR: 1,
  EDUCATOR: 2,
} as const;

export type AccessLevel = (typeof ACCESS_LEVELS)[keyof typeof ACCESS_LEVELS];

export type { SubscriptionStatus };

const ACCESS_LEVEL_TO_TIER: Record<AccessLevel, PlanTier> = {
  [ACCESS_LEVELS.FREE]: "free",
  [ACCESS_LEVELS.PRO_SCHOLAR]: "pro",
  [ACCESS_LEVELS.EDUCATOR]: "educator",
};

function isValidAccessLevel(level: number): level is AccessLevel {
  return (
    level === ACCESS_LEVELS.FREE ||
    level === ACCESS_LEVELS.PRO_SCHOLAR ||
    level === ACCESS_LEVELS.EDUCATOR
  );
}

export function normalizeAccessLevel(level: number): AccessLevel {
  if (isValidAccessLevel(level)) return level;
  console.warn(`Invalid access level ${level}, defaulting to FREE`);
  return ACCESS_LEVELS.FREE;
}

export function getAccessLevelName(accessLevel: AccessLevel): PlanTier {
  return ACCESS_LEVEL_TO_TIER[accessLevel] ?? "free";
}

/** Thin lookup into shared LIMITS_BY_TIER (SSOT). */
export function getLimitsForAccessLevel(accessLevel: AccessLevel): PlanLimits {
  const tier = getAccessLevelName(normalizeAccessLevel(accessLevel));
  return getLimitsForTier(tier);
}

export function isProOrHigher(accessLevel: AccessLevel): boolean {
  return accessLevel >= ACCESS_LEVELS.PRO_SCHOLAR;
}

export function parseSlugToAccessLevel(slug: string | undefined): AccessLevel {
  const tier = slugToTier(slug);
  const level = tierToAccessLevel(tier);
  return normalizeAccessLevel(level);
}

export async function getActiveSubscription(
  ctx: QueryCtx | MutationCtx,
  userId: string,
): Promise<Doc<"subscriptions"> | null> {
  const now = Date.now();
  const subscriptions = await ctx.db
    .query("subscriptions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  if (subscriptions.length === 0) return null;

  const activeSubscriptions = subscriptions.filter(
    (s) => s.status === "active",
  );

  if (activeSubscriptions.length > 0) {
    return activeSubscriptions.reduce(
      (best, current) =>
        current.accessLevel > best.accessLevel ? current : best,
      activeSubscriptions[0]!,
    );
  }

  // Check for canceled subscriptions still within their period
  const canceledWithTime = subscriptions.filter(
    (s) =>
      s.status === "canceled" &&
      s.currentPeriodEnd &&
      s.currentPeriodEnd > now,
  );

  if (canceledWithTime.length > 0) {
    return canceledWithTime.reduce(
      (best, current) =>
        current.accessLevel > best.accessLevel ? current : best,
      canceledWithTime[0]!,
    );
  }

  return null;
}

export async function getEffectiveAccessLevel(
  ctx: QueryCtx | MutationCtx,
  userId: string,
): Promise<AccessLevel> {
  const subscription = await getActiveSubscription(ctx, userId);
  if (subscription) {
    return normalizeAccessLevel(subscription.accessLevel);
  }
  return ACCESS_LEVELS.FREE;
}

export async function getEffectiveLimits(
  ctx: QueryCtx | MutationCtx,
  userId: string,
): Promise<PlanLimits> {
  const accessLevel = await getEffectiveAccessLevel(ctx, userId);
  return getLimitsForAccessLevel(accessLevel);
}

export async function getEffectiveAccessLevelForAction(
  ctx: ActionCtx,
  userId: string,
): Promise<AccessLevel> {
  const api = await import("./_generated/api");
  const internal = api.internal as unknown as {
    subscriptionServiceInternal: {
      getAccessLevel: (args: { userId: string }) => Promise<AccessLevel>;
    };
  };

  const subscriptionAccessLevel = await ctx.runQuery(
    internal.subscriptionServiceInternal.getAccessLevel as any,
    { userId },
  );

  return normalizeAccessLevel(subscriptionAccessLevel);
}

export async function getEffectiveLimitsForAction(
  ctx: ActionCtx,
  userId: string,
): Promise<PlanLimits> {
  const accessLevel = await getEffectiveAccessLevelForAction(ctx, userId);
  return getLimitsForAccessLevel(accessLevel);
}

export { PLAN_LIMIT_CODE, UNLIMITED_LIMIT, LIMITS_BY_TIER };
