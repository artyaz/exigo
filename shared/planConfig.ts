export type PlanTier = "free" | "basic" | "pro" | "educator";

export const PLAN_LIMIT_CODE = "PLAN_LIMIT_PRO_REQUIRED";

export const DEEP_DIVE_LIMITS_BY_TIER: Record<PlanTier, number> = {
    free: 0,
    basic: 0,
    pro: 50,
    educator: 150,
};

export function getDeepDiveLimitForTier(tier: string): number {
    if (tier in DEEP_DIVE_LIMITS_BY_TIER) {
        return DEEP_DIVE_LIMITS_BY_TIER[tier as PlanTier];
    }
    return DEEP_DIVE_LIMITS_BY_TIER.pro;
}
