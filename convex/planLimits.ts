import { query } from "./_generated/server";
import { DEEP_DIVE_LIMITS_BY_TIER, getDeepDiveLimitForTier, MAX_TESTS_SENTINEL, PLAN_LIMIT_CODE, UNLIMITED_LIMIT } from "../shared/planConfig";

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
    maxSpaces: UNLIMITED_LIMIT,
    maxTestsPerMonth: 100,
    maxKnowledgePiecesPerSpace: 200,
};

const EDUCATOR_TIER_LIMITS: ServerPlanLimits = {
    maxSpaces: UNLIMITED_LIMIT,
    maxTestsPerMonth: Math.min(300, MAX_TESTS_SENTINEL),
    maxKnowledgePiecesPerSpace: UNLIMITED_LIMIT,
};

const FREE_TIER_LIMITS: ServerPlanLimits = {
    maxSpaces: 3,
    maxTestsPerMonth: 10,
    maxKnowledgePiecesPerSpace: 20,
};

const LIMITED_TIER_LIMITS: ServerPlanLimits = {
    maxSpaces: 0,
    maxTestsPerMonth: 0,
    maxKnowledgePiecesPerSpace: 0,
};

const PLAN_KEYS = ["plan", "tier", "subscriptionPlan", "subscriptionTier"] as const;
const PLAN_FEATURE_FLAGS = [
    "unlimited_ai_tests",
    "unlimited_knowledge",
    "pro_tests",
    "pro_knowledge",
    "basic_tests",
    "basic_knowledge"
] as const;

type DetectedTier = "free" | "basic" | "pro" | "educator" | "limited" | null;

export { DEEP_DIVE_LIMITS_BY_TIER, getDeepDiveLimitForTier };
export { PLAN_LIMIT_CODE };

/**
 * Robustly checks for a feature flag in the user identity metadata.
 * Restricts search to standard Clerk metadata locations to avoid false positives.
 */
export function hasFeature(identity: Record<string, unknown>, feature: string): boolean {
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
    return String(value ?? "").trim().toLowerCase();
}

function collectPlanSignalValues(identityLike: Record<string, unknown>): unknown[] {
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
        return planValues.some(val => {
            const normalized = normalizePlanToken(val);
            return candidates.some(c => normalized.includes(c));
        });
    };

    if (isMatch(["educator", "teacher"])) return "educator";
    if (isMatch(["pro", "scholar", "premium", "plus"])) return "pro";
    if (isMatch(["basic", "starter"])) return "basic";
    if (isMatch(["limited", "restricted"])) return "limited";
    if (isMatch(["free"])) return "free";

    return null;
}

export function isProPlan(identityLike?: Record<string, unknown> | null): boolean {
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

export function getServerPlanLimitsForUser(userId: string, identityLike?: Record<string, unknown> | null): ServerPlanLimits {
    void userId;
    if (!identityLike) return FREE_TIER_LIMITS;

    const detectedTier = detectPlanTier(identityLike);
    const signals = collectPlanSignalValues(identityLike);

    const isEducator =
        detectedTier === "educator" ||
        hasFeature(identityLike, "unlimited_ai_tests") ||
        hasFeature(identityLike, "unlimited_knowledge");

    const isPro =
        detectedTier === "pro" ||
        hasFeature(identityLike, "pro_tests") ||
        hasFeature(identityLike, "pro_knowledge");

    const isBasic =
        detectedTier === "basic" ||
        hasFeature(identityLike, "basic_tests") ||
        hasFeature(identityLike, "basic_knowledge");

    if (isEducator) {
        return EDUCATOR_TIER_LIMITS;
    }

    if (isPro) {
        return PRO_TIER_LIMITS;
    }

    if (isBasic) {
        return BASIC_TIER_LIMITS;
    }

    if (detectedTier === "limited") {
        return LIMITED_TIER_LIMITS;
    }

    return FREE_TIER_LIMITS;
}


export const getPlan = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return {
                tier: "free",
                limits: FREE_TIER_LIMITS,
                features: {
                    conversational_ai: false,
                    deep_dive_limit: getDeepDiveLimitForTier("free"),
                }
            };
        }

        // Cast to Record<string, unknown> for helper functions
        const identityLike = identity as unknown as Record<string, unknown>;

        const limits = getServerPlanLimitsForUser(identity.subject, identityLike);
        const detectedTier = detectPlanTier(identityLike);

        const isEducator =
            detectedTier === "educator" ||
            hasFeature(identityLike, "unlimited_ai_tests") ||
            hasFeature(identityLike, "unlimited_knowledge");

        const isPro =
            isEducator ||
            detectedTier === "pro" ||
            hasFeature(identityLike, "pro_tests") ||
            hasFeature(identityLike, "pro_knowledge");

        const isBasic =
            detectedTier === "basic" ||
            hasFeature(identityLike, "basic_tests") ||
            hasFeature(identityLike, "basic_knowledge");

        const isLimited = detectedTier === "limited";

        let tier: "free" | "basic" | "pro" | "educator" | "limited" = "free";
        if (isEducator) {
            tier = "educator";
        } else if (isPro) {
            tier = "pro";
        } else if (isBasic) {
            tier = "basic";
        } else if (isLimited) {
            tier = "limited";
        }

        return {
            tier,
            limits,
            features: {
                conversational_ai: isPro,
                deep_dive_limit: getDeepDiveLimitForTier(tier),
            }
        };
    }
});
