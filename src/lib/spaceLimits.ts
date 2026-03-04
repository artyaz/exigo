import { UNLIMITED_LIMIT, slugToTier } from "../../shared/planConfig";

const TIER_SPACE_LIMITS: Record<string, number> = {
    free: 3,
    pro: UNLIMITED_LIMIT,
    educator: UNLIMITED_LIMIT,
};

export function getSpaceLimit(plan: string | undefined): number {
    const tier = slugToTier(plan);
    return TIER_SPACE_LIMITS[tier] ?? 3;
}
