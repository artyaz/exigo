import { MAX_TESTS_SENTINEL, slugToTier } from "../../shared/planConfig";

const TIER_TEST_LIMITS: Record<string, number> = {
    free: 10,
    pro: 100,
    educator: 300,
};

export function getTestLimit(plan: string | undefined): number {
    const tier = slugToTier(plan);
    const limit = TIER_TEST_LIMITS[tier] ?? 10;
    return Math.min(limit, MAX_TESTS_SENTINEL);
}
