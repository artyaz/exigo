import type { Doc } from "./_generated/dataModel";
import type { QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";
import type { SubscriptionStatus } from "../shared/subscriptionStatuses";
import {
  PLAN_LIMIT_CODE,
  UNLIMITED_LIMIT,
  MAX_TESTS_SENTINEL,
  DEEP_DIVE_LIMITS_BY_TIER,
  slugToTier,
  tierToAccessLevel,
} from "../shared/planConfig";

export const ACCESS_LEVELS = {
  FREE: 0,
  PRO_SCHOLAR: 1,
  EDUCATOR: 2,
} as const;

export type AccessLevel = (typeof ACCESS_LEVELS)[keyof typeof ACCESS_LEVELS];

export type { SubscriptionStatus };

export interface PlanLimits {
  maxSpaces: number;
  maxTestsPerMonth: number;
  maxKnowledgePiecesPerSpace: number;
  deepDiveLimit: number;
}

interface LimitStrategy {
  getLimits(): PlanLimits;
  getAccessLevel(): AccessLevel;
}

class FreeLimitStrategy implements LimitStrategy {
  getLimits(): PlanLimits {
    return {
      maxSpaces: 3,
      maxTestsPerMonth: 3,
      maxKnowledgePiecesPerSpace: 20,
      deepDiveLimit: DEEP_DIVE_LIMITS_BY_TIER.free,
    };
  }
  getAccessLevel(): AccessLevel {
    return ACCESS_LEVELS.FREE;
  }
}

class ProScholarLimitStrategy implements LimitStrategy {
  getLimits(): PlanLimits {
    return {
      maxSpaces: UNLIMITED_LIMIT,
      maxTestsPerMonth: 100,
      maxKnowledgePiecesPerSpace: 200,
      deepDiveLimit: DEEP_DIVE_LIMITS_BY_TIER.pro,
    };
  }
  getAccessLevel(): AccessLevel {
    return ACCESS_LEVELS.PRO_SCHOLAR;
  }
}

class EducatorLimitStrategy implements LimitStrategy {
  getLimits(): PlanLimits {
    return {
      maxSpaces: UNLIMITED_LIMIT,
      maxTestsPerMonth: Math.min(300, MAX_TESTS_SENTINEL),
      maxKnowledgePiecesPerSpace: UNLIMITED_LIMIT,
      deepDiveLimit: DEEP_DIVE_LIMITS_BY_TIER.educator,
    };
  }
  getAccessLevel(): AccessLevel {
    return ACCESS_LEVELS.EDUCATOR;
  }
}

const STRATEGIES: Record<AccessLevel, LimitStrategy> = {
  [ACCESS_LEVELS.FREE]: new FreeLimitStrategy(),
  [ACCESS_LEVELS.PRO_SCHOLAR]: new ProScholarLimitStrategy(),
  [ACCESS_LEVELS.EDUCATOR]: new EducatorLimitStrategy(),
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

export function getAccessLevelName(accessLevel: AccessLevel): string {
  switch (accessLevel) {
    case ACCESS_LEVELS.EDUCATOR:
      return "educator";
    case ACCESS_LEVELS.PRO_SCHOLAR:
      return "pro";
    default:
      return "free";
  }
}

export function getStrategy(accessLevel: AccessLevel): LimitStrategy {
  return STRATEGIES[accessLevel] ?? STRATEGIES[ACCESS_LEVELS.FREE];
}

export function getLimitsForAccessLevel(accessLevel: AccessLevel): PlanLimits {
  return getStrategy(accessLevel).getLimits();
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

export async function getTestsUsedThisMonth(
  ctx: QueryCtx | MutationCtx,
  userId: string,
): Promise<number> {
  const now = Date.now();
  const usage = await ctx.db
    .query("usage")
    .withIndex("by_user_metric", (q) =>
      q.eq("userId", userId).eq("metric", "tests"),
    )
    .first();

  if (!usage) return 0;
  // Check if the usage period is still valid
  if (usage.periodEnd < now) return 0;
  return usage.count;
}

export async function incrementTestsUsage(
  ctx: MutationCtx,
  userId: string,
): Promise<void> {
  const now = Date.now();
  const existing = await ctx.db
    .query("usage")
    .withIndex("by_user_metric", (q) =>
      q.eq("userId", userId).eq("metric", "tests"),
    )
    .first();

  if (existing && existing.periodEnd > now) {
    await ctx.db.patch(existing._id, { count: existing.count + 1 });
  } else {
    // Start a new 30-day period
    const periodStart = now;
    const periodEnd = now + 30 * 24 * 60 * 60 * 1000;
    if (existing) {
      await ctx.db.patch(existing._id, {
        count: 1,
        periodStart,
        periodEnd,
      });
    } else {
      await ctx.db.insert("usage", {
        userId,
        metric: "tests",
        count: 1,
        periodStart,
        periodEnd,
      });
    }
  }
}

export async function checkTestsLimit(
  ctx: MutationCtx,
  userId: string,
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const [limits, used] = await Promise.all([
    getEffectiveLimits(ctx, userId),
    getTestsUsedThisMonth(ctx, userId),
  ]);

  return {
    allowed:
      limits.maxTestsPerMonth === UNLIMITED_LIMIT ||
      used < limits.maxTestsPerMonth,
    used,
    limit: limits.maxTestsPerMonth,
  };
}

export { PLAN_LIMIT_CODE, UNLIMITED_LIMIT };
