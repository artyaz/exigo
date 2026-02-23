export type ServerPlanLimits = {
    maxSpaces: number;
    maxTestsPerMonth: number;
    maxKnowledgePiecesPerSpace: number;
};

const BASIC_TIER_LIMITS: ServerPlanLimits = {
    maxSpaces: 3,
    maxTestsPerMonth: 10,
    maxKnowledgePiecesPerSpace: 50,
};

const PRO_TIER_LIMITS: ServerPlanLimits = {
    maxSpaces: Number.MAX_SAFE_INTEGER,
    maxTestsPerMonth: 100,
    maxKnowledgePiecesPerSpace: 200,
};

const EDUCATOR_TIER_LIMITS: ServerPlanLimits = {
    maxSpaces: Number.MAX_SAFE_INTEGER,
    maxTestsPerMonth: 300,
    maxKnowledgePiecesPerSpace: Number.MAX_SAFE_INTEGER,
};

const FREE_TIER_LIMITS: ServerPlanLimits = {
    maxSpaces: 3,
    maxTestsPerMonth: 10,
    maxKnowledgePiecesPerSpace: 20,
};

function hasFeature(identity: Record<string, unknown>, feature: string): boolean {
    const claimCandidates = [
        identity,
        identity["claims"],
        identity["publicMetadata"],
        identity["privateMetadata"],
        identity["unsafeMetadata"],
    ];

    for (const candidate of claimCandidates) {
        if (!candidate || typeof candidate !== "object") continue;
        const value = (candidate as Record<string, unknown>)[feature];
        if (value === true) return true;
    }

    return false;
}

export function getServerPlanLimitsForUser(userId: string, identityLike?: Record<string, unknown> | null): ServerPlanLimits {
    void userId;
    if (!identityLike) return FREE_TIER_LIMITS;

    if (hasFeature(identityLike, "unlimited_ai_tests") || hasFeature(identityLike, "unlimited_knowledge")) {
        return EDUCATOR_TIER_LIMITS;
    }
    if (hasFeature(identityLike, "pro_tests") || hasFeature(identityLike, "pro_knowledge")) {
        return PRO_TIER_LIMITS;
    }
    if (hasFeature(identityLike, "basic_tests") || hasFeature(identityLike, "basic_knowledge")) {
        return BASIC_TIER_LIMITS;
    }

    return FREE_TIER_LIMITS;
}
