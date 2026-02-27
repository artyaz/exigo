import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";
import {
  PLAN_LIMIT_CODE,
  UNLIMITED_LIMIT,
  MAX_TESTS_SENTINEL,
  DEEP_DIVE_LIMITS_BY_TIER,
} from "../shared/planConfig";

export const ACCESS_LEVELS = {
  FREE: 0,
  PRO_SCHOLAR: 1,
  EDUCATOR: 2,
} as const;

export type AccessLevel = (typeof ACCESS_LEVELS)[keyof typeof ACCESS_LEVELS];

export type SubscriptionStatus = "active" | "canceled" | "past_due" | "expired";

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
      maxTestsPerMonth: 10,
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
      return "pro_scholar";
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

export function parseClerkPlanSlug(slug: string | undefined): AccessLevel {
  if (!slug) return ACCESS_LEVELS.FREE;
  const normalized = slug.toLowerCase().trim();

  if (normalized === "educator") return ACCESS_LEVELS.EDUCATOR;
  if (normalized === "pro_scholar" || normalized === "pro-scholar")
    return ACCESS_LEVELS.PRO_SCHOLAR;
  if (
    normalized === "basic_tests" ||
    normalized === "free_user" ||
    normalized === "free"
  )
    return ACCESS_LEVELS.FREE;

  if (/educator|teacher/.test(normalized)) return ACCESS_LEVELS.EDUCATOR;
  if (/pro|scholar|premium|plus/.test(normalized))
    return ACCESS_LEVELS.PRO_SCHOLAR;

  return ACCESS_LEVELS.FREE;
}

export async function getActiveSubscription(
  ctx: QueryCtx | MutationCtx,
  userId: string,
): Promise<Doc<"subscriptions"> | null> {
  const now = Date.now();
  const subscription = await ctx.db
    .query("subscriptions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  if (!subscription) return null;

  if (subscription.status === "active") return subscription;

  if (subscription.status === "canceled" && subscription.periodEnd) {
    if (subscription.periodEnd > now) return subscription;
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

  const identity = await ctx.auth.getUserIdentity();
  if (identity?.subject === userId) {
    const identityLike = identity as unknown as Record<string, unknown>;
    const slug = detectPlanSlugFromIdentity(identityLike);
    if (slug) {
      return parseClerkPlanSlug(slug);
    }
  }

  return ACCESS_LEVELS.FREE;
}

function detectPlanSlugFromIdentity(
  identityLike: Record<string, unknown>,
): string {
  const planValues: unknown[] = [];

  const addValues = (target: unknown) => {
    if (!target || typeof target !== "object") return;
    const t = target as Record<string, unknown>;
    for (const key of [
      "plan",
      "tier",
      "subscriptionPlan",
      "subscriptionTier",
    ]) {
      if (Object.prototype.hasOwnProperty.call(t, key)) {
        planValues.push(t[key]);
      }
    }
  };

  addValues(identityLike);
  addValues(identityLike.publicMetadata);
  addValues(identityLike.privateMetadata);
  addValues((identityLike as Record<string, unknown>).unsafeMetadata);

  const org = (identityLike as Record<string, unknown>).organization as
    | Record<string, unknown>
    | undefined;
  if (org) {
    addValues(org.publicMetadata);
    addValues(org.privateMetadata);
    addValues(org.unsafeMetadata);
  }

  const isMatch = (candidates: string[]) => {
    return planValues.some((val) => {
      const normalized = String(val ?? "")
        .trim()
        .toLowerCase();
      return candidates.some((c) => normalized.includes(c));
    });
  };

  if (isMatch(["educator", "teacher"])) return "educator";
  if (isMatch(["pro", "scholar", "premium", "plus"])) return "pro_scholar";
  if (isMatch(["basic", "starter"])) return "basic_tests";

  const checkFeature = (feature: string): boolean => {
    const searchTargets = [
      identityLike,
      identityLike.publicMetadata,
      (identityLike as Record<string, unknown>).unsafeMetadata,
    ];
    const org = (identityLike as Record<string, unknown>).organization as
      | Record<string, unknown>
      | undefined;
    if (org) {
      searchTargets.push(org.publicMetadata, org.unsafeMetadata);
    }
    for (const target of searchTargets) {
      if (target && typeof target === "object") {
        const t = target as Record<string, unknown>;
        const val = t[feature];
        if (val === true || val === "true" || val === 1 || val === "1") {
          return true;
        }
      }
    }
    return false;
  };

  if (
    checkFeature("unlimited_ai_tests") ||
    checkFeature("unlimited_knowledge")
  ) {
    return "educator";
  }
  if (checkFeature("pro_tests") || checkFeature("pro_knowledge")) {
    return "pro_scholar";
  }
  if (checkFeature("basic_tests") || checkFeature("basic_knowledge")) {
    return "basic_tests";
  }

  return "";
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

  const normalizedLevel = normalizeAccessLevel(subscriptionAccessLevel);
  if (normalizedLevel > ACCESS_LEVELS.FREE) {
    return normalizedLevel;
  }

  const identity = await ctx.auth.getUserIdentity();
  if (identity?.subject === userId) {
    const identityLike = identity as unknown as Record<string, unknown>;
    const slug = detectPlanSlugFromIdentity(identityLike);
    if (slug) {
      return parseClerkPlanSlug(slug);
    }
  }

  return ACCESS_LEVELS.FREE;
}

export async function getEffectiveLimitsForAction(
  ctx: ActionCtx,
  userId: string,
): Promise<PlanLimits> {
  const accessLevel = await getEffectiveAccessLevelForAction(ctx, userId);
  return getLimitsForAccessLevel(accessLevel);
}

export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function getTestsUsedThisMonth(
  ctx: QueryCtx | MutationCtx,
  userId: string,
): Promise<number> {
  const month = getCurrentMonth();
  const usage = await ctx.db
    .query("testsUsage")
    .withIndex("by_user_month", (q) =>
      q.eq("userId", userId).eq("month", month),
    )
    .first();
  return usage?.count ?? 0;
}

export async function incrementTestsUsage(
  ctx: MutationCtx,
  userId: string,
): Promise<void> {
  const month = getCurrentMonth();
  const existing = await ctx.db
    .query("testsUsage")
    .withIndex("by_user_month", (q) =>
      q.eq("userId", userId).eq("month", month),
    )
    .first();

  if (existing) {
    await ctx.db.patch(existing._id, { count: existing.count + 1 });
  } else {
    await ctx.db.insert("testsUsage", { userId, month, count: 1 });
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
