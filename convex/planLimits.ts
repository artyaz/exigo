export type ServerPlanLimits = {
    maxSpaces: number;
    maxTestsPerMonth: number;
    maxKnowledgePiecesPerSpace: number;
};

const FREE_TIER_LIMITS: ServerPlanLimits = {
    maxSpaces: 3,
    maxTestsPerMonth: 10,
    maxKnowledgePiecesPerSpace: 20,
};

export function getServerPlanLimitsForUser(_userId: string): ServerPlanLimits {
    // Limits are enforced server-side in Convex so clients cannot tamper with quotas.
    // If plan tiers are stored in Convex later, this function should read them here.
    return FREE_TIER_LIMITS;
}
