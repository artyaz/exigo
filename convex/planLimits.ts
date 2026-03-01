import { query } from "./_generated/server";
import {
  DEEP_DIVE_LIMITS_BY_TIER,
  getDeepDiveLimitForTier,
  MAX_TESTS_SENTINEL,
  PLAN_LIMIT_CODE,
  UNLIMITED_LIMIT,
} from "../shared/planConfig";
import {
  getLimitsForAccessLevel,
  parseClerkPlanSlug,
  ACCESS_LEVELS,
  getActiveSubscription,
  type PlanLimits,
} from "./subscriptionService";
import { getAuthedContext } from "./authDecorators";

export type ServerPlanLimits = PlanLimits;

export { DEEP_DIVE_LIMITS_BY_TIER, getDeepDiveLimitForTier };
export { PLAN_LIMIT_CODE };
export type { PlanLimits };

const PLAN_KEYS = [
  "plan",
  "tier",
  "subscriptionPlan",
  "subscriptionTier",
] as const;
const PLAN_FEATURE_FLAGS = [
  "unlimited_ai_tests",
  "unlimited_knowledge",
  "pro_tests",
  "pro_knowledge",
  "basic_tests",
  "basic_knowledge",
] as const;

type DetectedTier = "free" | "basic" | "pro" | "educator" | "limited" | null;

export function hasFeature(
  identity: Record<string, unknown>,
  feature: string,
): boolean {
  const searchTargets = [
    identity,
    identity.publicMetadata,
    identity.privateMetadata,
    identity.unsafeMetadata,
    (identity.organization as any)?.publicMetadata,
    (identity.organization as any)?.privateMetadata,
    (identity.organization as any)?.unsafeMetadata,
  ];

  for (const target of searchTargets) {
    if (target && typeof target === "object") {
      const val = (target as Record<string, unknown>)[feature];
      if (val === true || val === "true" || val === 1 || val === "1") {
        return true;
      }
    }
  }
  return false;
}

function normalizePlanToken(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function collectPlanSignalValues(
  identityLike: Record<string, unknown>,
): unknown[] {
  const values: unknown[] = [];

  const addValues = (target: any) => {
    if (!target || typeof target !== "object") return;
    for (const key of PLAN_KEYS) {
      if (Object.prototype.hasOwnProperty.call(target, key)) {
        values.push(target[key]);
      }
    }
  };

  addValues(identityLike);
  addValues(identityLike.publicMetadata);
  addValues(identityLike.privateMetadata);
  addValues(identityLike.unsafeMetadata);

  const org = identityLike.organization as any;
  if (org) {
    addValues(org);
    addValues(org.publicMetadata);
    addValues(org.privateMetadata);
    addValues(org.unsafeMetadata);
  }

  return values;
}

function detectPlanTier(identityLike: Record<string, unknown>): DetectedTier {
  const planValues = collectPlanSignalValues(identityLike);

  const isMatch = (candidates: string[]) => {
    return planValues.some((val) => {
      const normalized = normalizePlanToken(val);
      return candidates.some((c) => normalized.includes(c));
    });
  };

  if (isMatch(["educator", "teacher"])) return "educator";
  if (isMatch(["pro", "scholar", "premium", "plus"])) return "pro";
  if (isMatch(["basic", "starter"])) return "basic";
  if (isMatch(["limited", "restricted"])) return "limited";
  if (isMatch(["free"])) return "free";

  return null;
}

export function isProPlan(
  identityLike?: Record<string, unknown> | null,
): boolean {
  if (!identityLike) return false;

  if (
    hasFeature(identityLike, "pro_tests") ||
    hasFeature(identityLike, "pro_knowledge") ||
    hasFeature(identityLike, "unlimited_ai_tests") ||
    hasFeature(identityLike, "unlimited_knowledge")
  ) {
    return true;
  }

  const detectedTier = detectPlanTier(identityLike);
  return detectedTier === "pro" || detectedTier === "educator";
}

export function getServerPlanLimitsForUser(
  userId: string,
  identityLike?: Record<string, unknown> | null,
): ServerPlanLimits {
  void userId;

  if (!identityLike) {
    return getLimitsForAccessLevel(ACCESS_LEVELS.FREE);
  }

  const slug = detectPlanSlugFromIdentity(identityLike);
  const accessLevel = parseClerkPlanSlug(slug);
  return getLimitsForAccessLevel(accessLevel);
}

function detectPlanSlugFromIdentity(
  identityLike: Record<string, unknown>,
): string {
  const detectedTier = detectPlanTier(identityLike);

  if (
    hasFeature(identityLike, "unlimited_ai_tests") ||
    hasFeature(identityLike, "unlimited_knowledge") ||
    detectedTier === "educator"
  ) {
    return "educator";
  }

  if (
    hasFeature(identityLike, "pro_tests") ||
    hasFeature(identityLike, "pro_knowledge") ||
    detectedTier === "pro"
  ) {
    return "pro_scholar";
  }

  if (
    hasFeature(identityLike, "basic_tests") ||
    hasFeature(identityLike, "basic_knowledge") ||
    detectedTier === "basic"
  ) {
    return "basic_tests";
  }

  return "";
}

export const getPlan = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        tier: "free",
        limits: getLimitsForAccessLevel(ACCESS_LEVELS.FREE),
        hasActiveSubscription: false,
        features: {
          conversational_ai: false,
          deep_dive_limit: getDeepDiveLimitForTier("free"),
        },
      };
    }

    const auth = await getAuthedContext(ctx);
    const { accessLevel, limits } = auth;
    const subscription = await getActiveSubscription(ctx, auth.userId);

    const isPro = accessLevel >= ACCESS_LEVELS.PRO_SCHOLAR;

    let tier: "free" | "basic" | "pro" | "educator" | "limited" = "free";
    if (accessLevel === ACCESS_LEVELS.EDUCATOR) {
      tier = "educator";
    } else if (accessLevel === ACCESS_LEVELS.PRO_SCHOLAR) {
      tier = "pro";
    }

    return {
      tier,
      limits,
      hasActiveSubscription: subscription !== null,
      features: {
        conversational_ai: isPro,
        deep_dive_limit: limits.deepDiveLimit,
      },
    };
  },
});
