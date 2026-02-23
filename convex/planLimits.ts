import { query } from "./_generated/server";

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

function deepFind(obj: any, key: string): any {
    if (!obj || typeof obj !== "object") return undefined;
    if (key in obj) return obj[key];
    for (const k in obj) {
        const found = deepFind(obj[k], key);
        if (found !== undefined) return found;
    }
    return undefined;
}

export function hasFeature(identity: Record<string, unknown>, feature: string): boolean {
    const value = deepFind(identity, feature);
    return value === true || value === "true";
}

function universalPlanCheck(obj: any): boolean {
    if (!obj || typeof obj !== "object") return false;
    const keywords = ["pro", "scholar", "educator", "unlimited", "ai_tests"];

    for (const key in obj) {
        const lowKey = key.toLowerCase();
        if (keywords.some(k => lowKey.includes(k))) {
            return true;
        }

        const value = obj[key];
        if (typeof value === "string") {
            const lowVal = value.toLowerCase();
            if (keywords.some(k => lowVal.includes(k))) {
                return true;
            }
        } else if (typeof value === "object" && value !== null) {
            if (universalPlanCheck(value)) return true;
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

    // Use universal check to determine tier if explicit matching fails
    const plan = String(deepFind(identityLike, "plan") ?? "").toLowerCase();

    if (plan.includes("educator") || hasFeature(identityLike, "unlimited_ai_tests") || hasFeature(identityLike, "unlimited_knowledge")) {
        return EDUCATOR_TIER_LIMITS;
    }

    if (plan.includes("pro") || plan.includes("scholar") || hasFeature(identityLike, "pro_tests") || hasFeature(identityLike, "pro_knowledge")) {
        return PRO_TIER_LIMITS;
    }

    // Final fallback: if isProPlan says true but we haven't matched specific educator flags, give Pro limits
    if (isProPlan(identityLike)) {
        return PRO_TIER_LIMITS;
    }

    if (plan.includes("basic") || hasFeature(identityLike, "basic_tests") || hasFeature(identityLike, "basic_knowledge")) {
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
        const planStr = String(deepFind(identity, "plan") ?? "").toLowerCase();
        const isEducator = planStr.includes("educator") || hasFeature(identity, "unlimited_ai_tests");

        return {
            tier: isEducator ? "educator" : isPro ? "pro" : "free",
            limits,
            features: {
                conversational_ai: isPro || isEducator,
            }
        };
    }
});
