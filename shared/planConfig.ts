export type PlanTier = "free" | "pro" | "educator";

export const PLAN_LIMIT_CODE = "PLAN_LIMIT_PRO_REQUIRED";
export const RESOLUTION_THRESHOLD = 90;
export const UNLIMITED_LIMIT = Infinity;

// Absolute hard cap for tests to ensure no true "unlimited" usage exists
export const MAX_TESTS_SENTINEL = 1000;

export const ACCESS_LEVEL_MAP: Record<PlanTier, number> = {
    free: 0,
    pro: 1,
    educator: 2,
};

export const DEEP_DIVE_LIMITS_BY_TIER: Record<PlanTier, number> = {
    free: 0,
    pro: 50,
    educator: 150,
};

export function getDeepDiveLimitForTier(tier: string): number {
    if (tier in DEEP_DIVE_LIMITS_BY_TIER) {
        return DEEP_DIVE_LIMITS_BY_TIER[tier as PlanTier];
    }
    return DEEP_DIVE_LIMITS_BY_TIER.free;
}

/**
 * Resolve a plan slug (e.g. "pro-monthly", "educator-annual") to a tier key.
 */
export function slugToTier(slug: string | undefined | null): PlanTier {
    if (!slug) return "free";
    const s = slug.toLowerCase();
    if (s.startsWith("educator")) return "educator";
    if (s.startsWith("pro")) return "pro";
    return "free";
}

export function tierToAccessLevel(tier: PlanTier): number {
    return ACCESS_LEVEL_MAP[tier] ?? 0;
}
