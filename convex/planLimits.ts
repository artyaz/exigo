import { query } from "./_generated/server";
import { DEEP_DIVE_LIMITS_BY_TIER, getDeepDiveLimitForTier, PLAN_LIMIT_CODE, UNLIMITED_LIMIT } from "../shared/planConfig";

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
    maxTestsPerMonth: 300,
    maxKnowledgePiecesPerSpace: UNLIMITED_LIMIT,
};

const FREE_TIER_LIMITS: ServerPlanLimits = {
    maxSpaces: 3,
    maxTestsPerMonth: 10,
    maxKnowledgePiecesPerSpace: 20,
};

const PLAN_KEYS = ["plan", "tier", "subscriptionPlan", "subscriptionTier"] as const;

type DetectedTier = "free" | "basic" | "pro" | "educator" | null;

export { DEEP_DIVE_LIMITS_BY_TIER, getDeepDiveLimitForTier };
export { PLAN_LIMIT_CODE };

function deepFindAll(obj: unknown, key: string, visited = new Set<object>()): unknown[] {
    if (!obj || typeof obj !== "object") {
        return [];
    }

    const record = obj as Record<string, unknown>;
    if (visited.has(record)) {
        return [];
    }
    visited.add(record);

    const found: unknown[] = [];
    if (Object.prototype.hasOwnProperty.call(record, key)) {
        found.push(record[key]);
    }

    for (const value of Object.values(record)) {
        found.push(...deepFindAll(value, key, visited));
    }

    return found;
}

export function hasFeature(identity: Record<string, unknown>, feature: string): boolean {
    const values = deepFindAll(identity, feature);
    return values.some((value) => value === true || value === "true" || value === 1 || value === "1");
}

function normalizePlanToken(value: unknown): string {
    return String(value ?? "").trim().toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function getOwn(record: Record<string, unknown>, key: string): unknown {
    return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
}

function collectPlanSignalValues(identityLike: Record<string, unknown>): unknown[] {
    const values: unknown[] = [];

    const pushPlanKeys = (candidate: unknown) => {
        if (!isRecord(candidate)) return;
        for (const key of PLAN_KEYS) {
            const raw = getOwn(candidate, key);
            if (raw !== undefined) {
                values.push(raw);
            }
        }
    };

    // Top-level identity fields.
    pushPlanKeys(identityLike);
    // Common metadata locations used with Clerk.
    pushPlanKeys(getOwn(identityLike, "publicMetadata"));
    pushPlanKeys(getOwn(identityLike, "privateMetadata"));
    pushPlanKeys(getOwn(identityLike, "unsafeMetadata"));

    const organization = getOwn(identityLike, "organization");
    if (isRecord(organization)) {
        pushPlanKeys(organization);
        pushPlanKeys(getOwn(organization, "publicMetadata"));
        pushPlanKeys(getOwn(organization, "privateMetadata"));
        pushPlanKeys(getOwn(organization, "unsafeMetadata"));
    }

    return values;
}

function tokenizePlanValue(value: unknown): string[] {
    return normalizePlanToken(value)
        .split(/[^a-z0-9]+/)
        .filter(Boolean);
}

function hasAnyToken(tokens: string[], candidates: string[]): boolean {
    return candidates.some((candidate) => tokens.includes(candidate));
}

function detectPlanTier(identityLike: Record<string, unknown>): DetectedTier {
    const planValues = collectPlanSignalValues(identityLike);
    const tokens = planValues.flatMap((value) => tokenizePlanValue(value));

    if (hasAnyToken(tokens, ["educator", "teacher"])) {
        return "educator";
    }

    if (hasAnyToken(tokens, ["pro", "scholar", "premium", "plus"])) {
        return "pro";
    }

    if (hasAnyToken(tokens, ["basic", "starter"])) {
        return "basic";
    }

    if (hasAnyToken(tokens, ["free"])) {
        return "free";
    }

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

    const isEducator =
        detectedTier === "educator" ||
        hasFeature(identityLike, "unlimited_ai_tests") ||
        hasFeature(identityLike, "unlimited_knowledge");

    if (isEducator) {
        return EDUCATOR_TIER_LIMITS;
    }

    const isPro =
        detectedTier === "pro" ||
        hasFeature(identityLike, "pro_tests") ||
        hasFeature(identityLike, "pro_knowledge");

    if (isPro) {
        return PRO_TIER_LIMITS;
    }

    const isBasic =
        detectedTier === "basic" ||
        hasFeature(identityLike, "basic_tests") ||
        hasFeature(identityLike, "basic_knowledge");

    if (isBasic) {
        return BASIC_TIER_LIMITS;
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

        const limits = getServerPlanLimitsForUser(identity.subject, identity);
        const detectedTier = detectPlanTier(identity);

        const isEducator =
            detectedTier === "educator" ||
            hasFeature(identity, "unlimited_ai_tests") ||
            hasFeature(identity, "unlimited_knowledge");

        const isPro =
            isEducator ||
            detectedTier === "pro" ||
            hasFeature(identity, "pro_tests") ||
            hasFeature(identity, "pro_knowledge");

        const isBasic =
            detectedTier === "basic" ||
            hasFeature(identity, "basic_tests") ||
            hasFeature(identity, "basic_knowledge");

        let tier: "free" | "basic" | "pro" | "educator" = "free";
        if (isEducator) {
            tier = "educator";
        } else if (isPro) {
            tier = "pro";
        } else if (isBasic) {
            tier = "basic";
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
