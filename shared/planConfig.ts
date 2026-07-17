export type PlanTier = "free" | "pro" | "educator";

export const PLAN_LIMIT_CODE = "PLAN_LIMIT_PRO_REQUIRED";
export const RESOLUTION_THRESHOLD = 90;
export const UNLIMITED_LIMIT = Infinity;

// Absolute hard cap for tests to ensure no true "unlimited" usage exists
export const MAX_TESTS_SENTINEL = 1000;

export const ACCESS_LEVEL_MAP: Record<PlanTier, number> = {
    free: 0,
    pro: 1,
    educator: 2,
};

/**
 * Single source of truth for numeric plan entitlements.
 * Enforcement (Convex strategies/helpers) and marketing/seed copy must read from here.
 */
export interface PlanLimits {
    maxSpaces: number;
    maxTestsPerMonth: number;
    maxKnowledgePiecesPerSpace: number;
    deepDiveLimit: number;
}

export const LIMITS_BY_TIER: Record<PlanTier, PlanLimits> = {
    free: {
        maxSpaces: 3,
        maxTestsPerMonth: 3,
        maxKnowledgePiecesPerSpace: 20,
        deepDiveLimit: 0,
    },
    pro: {
        maxSpaces: UNLIMITED_LIMIT,
        maxTestsPerMonth: 100,
        maxKnowledgePiecesPerSpace: 200,
        deepDiveLimit: 50,
    },
    educator: {
        maxSpaces: UNLIMITED_LIMIT,
        // 300 < MAX_TESTS_SENTINEL; keep explicit finite cap (no Math.min noise)
        maxTestsPerMonth: 300,
        maxKnowledgePiecesPerSpace: UNLIMITED_LIMIT,
        deepDiveLimit: 150,
    },
};

/** Deep-dive caps only — derived from LIMITS_BY_TIER so callers cannot drift. */
export const DEEP_DIVE_LIMITS_BY_TIER: Record<PlanTier, number> = {
    free: LIMITS_BY_TIER.free.deepDiveLimit,
    pro: LIMITS_BY_TIER.pro.deepDiveLimit,
    educator: LIMITS_BY_TIER.educator.deepDiveLimit,
};

export function getLimitsForTier(tier: PlanTier): PlanLimits {
    return LIMITS_BY_TIER[tier];
}

export function getDeepDiveLimitForTier(tier: string): number {
    if (tier in LIMITS_BY_TIER) {
        return LIMITS_BY_TIER[tier as PlanTier].deepDiveLimit;
    }
    return LIMITS_BY_TIER.free.deepDiveLimit;
}

/**
 * Marketing/seed perk strings derived from LIMITS_BY_TIER so UI cannot advertise
 * numbers that enforcement does not honor (e.g. free "10 AI tests" vs code 3).
 */
export type MarketingPerk = { text: string; link?: string };

export function getMarketingPerksForTier(tier: PlanTier): MarketingPerk[] {
    const L = LIMITS_BY_TIER[tier];
    const spacesText =
        L.maxSpaces === UNLIMITED_LIMIT
            ? "Unlimited spaces"
            : `${L.maxSpaces} spaces`;
    const knowledgeText =
        L.maxKnowledgePiecesPerSpace === UNLIMITED_LIMIT
            ? "Unlimited knowledge pieces"
            : `${L.maxKnowledgePiecesPerSpace} knowledge pieces / space`;
    const testsText = `${L.maxTestsPerMonth} AI tests / month`;

    const perks: MarketingPerk[] = [
        { text: spacesText },
        { text: knowledgeText },
        { text: testsText },
    ];

    if (L.deepDiveLimit > 0) {
        perks.push({ text: "Deep dive analysis", link: "/knowledge-nodes" });
    }

    return perks;
}

/**
 * Resolve a plan slug (e.g. "pro-monthly", "educator-annual") to a tier key.
 */
export function slugToTier(slug: string | undefined | null): PlanTier {
    if (typeof slug !== "string" || !slug) return "free";
    const s = slug.toLowerCase();
    if (s.startsWith("educator")) return "educator";
    if (s.startsWith("pro")) return "pro";
    return "free";
}

export function tierToAccessLevel(tier: PlanTier): number {
    return ACCESS_LEVEL_MAP[tier] ?? 0;
}
