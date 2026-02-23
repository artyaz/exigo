import { query } from "./_generated/server";
import { DEEP_DIVE_LIMITS_BY_TIER, getDeepDiveLimitForTier, PLAN_LIMIT_CODE } from "../shared/planConfig";

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

export { DEEP_DIVE_LIMITS_BY_TIER, getDeepDiveLimitForTier };
export { PLAN_LIMIT_CODE };

function deepFind(obj: unknown, key: string): unknown {
    if (!obj || typeof obj !== "object") return undefined;
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
        return (obj as Record<string, unknown>)[key];
    }
    for (const k of Object.keys(obj)) {
        const found = deepFind((obj as Record<string, unknown>)[k], key);
        if (found !== undefined) return found;
    }
    return undefined;
}

export function hasFeature(identity: Record<string, unknown>, feature: string): boolean {
    const value = deepFind(identity, feature);
    return value === true || value === "true";
}

function normalizePlanToken(value: unknown): string {
    return String(value ?? "").trim().toLowerCase();
}

function containsPlanWord(value: string, token: "basic" | "pro" | "scholar" | "educator"): boolean {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`);
    return regex.test(value);
}

function universalPlanCheck(identityLike: Record<string, unknown>): boolean {
    const explicitPlanValues = [
        deepFind(identityLike, "plan"),
        deepFind(identityLike, "tier"),
        deepFind(identityLike, "subscription"),
        deepFind(identityLike, "subscriptionPlan"),
        deepFind(identityLike, "subscriptionTier"),
    ];

    for (const raw of explicitPlanValues) {
        const value = normalizePlanToken(raw);
        if (!value) continue;
        if (containsPlanWord(value, "pro") || containsPlanWord(value, "scholar") || containsPlanWord(value, "educator")) {
            return true;
        }
    }

    return false;
}

export function isProPlan(identityLike?: Record<string, unknown> | null): boolean {
    if (!identityLike) return false;

    // 1. Check for specific features first (high priority)
    if (hasFeature(identityLike, "pro_tests") ||
        hasFeature(identityLike, "pro_knowledge") ||
        hasFeature(identityLike, "unlimited_ai_tests") ||
        hasFeature(identityLike, "unlimited_knowledge")) {
        return true;
    }

    // 2. Scan entire identity object for plan keywords
    return universalPlanCheck(identityLike);
}

export function getServerPlanLimitsForUser(userId: string, identityLike?: Record<string, unknown> | null): ServerPlanLimits {
    void userId;
    if (!identityLike) return FREE_TIER_LIMITS;

    const plan = normalizePlanToken(deepFind(identityLike, "plan"));

    if (containsPlanWord(plan, "educator") || hasFeature(identityLike, "unlimited_ai_tests") || hasFeature(identityLike, "unlimited_knowledge")) {
        return EDUCATOR_TIER_LIMITS;
    }

    if (containsPlanWord(plan, "pro") || containsPlanWord(plan, "scholar") || hasFeature(identityLike, "pro_tests") || hasFeature(identityLike, "pro_knowledge")) {
        return PRO_TIER_LIMITS;
    }

    // Final fallback: if isProPlan says true but we haven't matched specific educator flags, give Pro limits
    if (isProPlan(identityLike)) {
        return PRO_TIER_LIMITS;
    }

    if (containsPlanWord(plan, "basic") || hasFeature(identityLike, "basic_tests") || hasFeature(identityLike, "basic_knowledge")) {
        return BASIC_TIER_LIMITS;
    }

    return FREE_TIER_LIMITS;
}


export const getPlan = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return { tier: "free", limits: FREE_TIER_LIMITS, features: { conversational_ai: false } };

        const limits = getServerPlanLimitsForUser(identity.subject, identity);
        const isPro = isProPlan(identity);
        const planStr = normalizePlanToken(deepFind(identity, "plan"));
        const isEducator = containsPlanWord(planStr, "educator") || hasFeature(identity, "unlimited_ai_tests");
        let tier: "free" | "pro" | "educator" = "free";
        if (isEducator) {
            tier = "educator";
        } else if (isPro) {
            tier = "pro";
        }

        return {
            tier,
            limits,
            features: {
                conversational_ai: isPro || isEducator,
                deep_dive_limit: getDeepDiveLimitForTier(tier),
            }
        };
    }
});
