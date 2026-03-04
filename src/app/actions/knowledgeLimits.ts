import { UNLIMITED_LIMIT, slugToTier } from "../../../shared/planConfig";

const TIER_KNOWLEDGE_LIMITS: Record<string, number> = {
    free: 20,
    pro: 200,
    educator: UNLIMITED_LIMIT,
};

export function getMaxKnowledgePieces(plan: string | undefined): number {
    const tier = slugToTier(plan);
    return TIER_KNOWLEDGE_LIMITS[tier] ?? 20;
}
