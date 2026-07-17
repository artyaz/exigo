import { describe, expect, it } from "vitest";
import {
  getLimitsForAccessLevel,
  parseSlugToAccessLevel,
  ACCESS_LEVELS,
} from "./subscriptionService";
import {
  UNLIMITED_LIMIT,
  LIMITS_BY_TIER,
  getLimitsForTier,
  getMarketingPerksForTier,
  type PlanTier,
} from "../shared/planConfig";

describe("parseSlugToAccessLevel", () => {
  it("returns FREE for undefined slug", () => {
    expect(parseSlugToAccessLevel(undefined)).toBe(ACCESS_LEVELS.FREE);
  });

  it("returns FREE for 'free' slug", () => {
    expect(parseSlugToAccessLevel("free")).toBe(ACCESS_LEVELS.FREE);
  });

  it("returns PRO_SCHOLAR for pro-monthly slug", () => {
    expect(parseSlugToAccessLevel("pro-monthly")).toBe(ACCESS_LEVELS.PRO_SCHOLAR);
  });

  it("returns PRO_SCHOLAR for pro-annual slug", () => {
    expect(parseSlugToAccessLevel("pro-annual")).toBe(ACCESS_LEVELS.PRO_SCHOLAR);
  });

  it("returns EDUCATOR for educator-monthly slug", () => {
    expect(parseSlugToAccessLevel("educator-monthly")).toBe(ACCESS_LEVELS.EDUCATOR);
  });

  it("returns EDUCATOR for educator-annual slug", () => {
    expect(parseSlugToAccessLevel("educator-annual")).toBe(ACCESS_LEVELS.EDUCATOR);
  });

  it("returns FREE for unrecognized slug", () => {
    expect(parseSlugToAccessLevel("unknown-plan")).toBe(ACCESS_LEVELS.FREE);
  });
});

describe("getLimitsForAccessLevel (lookup into LIMITS_BY_TIER)", () => {
  it("returns free tier limits from SSOT", () => {
    const limits = getLimitsForAccessLevel(ACCESS_LEVELS.FREE);
    expect(limits).toEqual(LIMITS_BY_TIER.free);
    expect(limits.maxTestsPerMonth).toBe(3);
  });

  it("returns pro tier limits from SSOT", () => {
    const limits = getLimitsForAccessLevel(ACCESS_LEVELS.PRO_SCHOLAR);
    expect(limits).toEqual(LIMITS_BY_TIER.pro);
    expect(limits.maxSpaces).toBe(UNLIMITED_LIMIT);
    expect(limits.maxTestsPerMonth).toBe(100);
  });

  it("returns educator tier limits from SSOT", () => {
    const limits = getLimitsForAccessLevel(ACCESS_LEVELS.EDUCATOR);
    expect(limits).toEqual(LIMITS_BY_TIER.educator);
    expect(limits.maxTestsPerMonth).toBe(300);
    expect(limits.maxKnowledgePiecesPerSpace).toBe(UNLIMITED_LIMIT);
  });

  it("matches getLimitsForTier for every access level", () => {
    const pairs: Array<[number, PlanTier]> = [
      [ACCESS_LEVELS.FREE, "free"],
      [ACCESS_LEVELS.PRO_SCHOLAR, "pro"],
      [ACCESS_LEVELS.EDUCATOR, "educator"],
    ];
    for (const [level, tier] of pairs) {
      expect(getLimitsForAccessLevel(level as 0 | 1 | 2)).toEqual(
        getLimitsForTier(tier),
      );
    }
  });
});

describe("marketing perks match LIMITS_BY_TIER (no drift)", () => {
  const tiers: PlanTier[] = ["free", "pro", "educator"];

  it("free marketing advertises 3 AI tests / month, not 10", () => {
    const texts = getMarketingPerksForTier("free").map((p) => p.text);
    expect(texts).toContain("3 AI tests / month");
    expect(texts.some((t) => t.includes("10 AI tests"))).toBe(false);
  });

  it("each tier's perk strings include that tier's numeric limits", () => {
    for (const tier of tiers) {
      const L = LIMITS_BY_TIER[tier];
      const texts = getMarketingPerksForTier(tier).map((p) => p.text);
      const joined = texts.join(" | ");

      expect(joined).toContain(`${L.maxTestsPerMonth} AI tests / month`);

      if (L.maxSpaces === UNLIMITED_LIMIT) {
        expect(joined).toContain("Unlimited spaces");
      } else {
        expect(joined).toContain(`${L.maxSpaces} spaces`);
      }

      if (L.maxKnowledgePiecesPerSpace === UNLIMITED_LIMIT) {
        expect(joined).toContain("Unlimited knowledge pieces");
      } else {
        expect(joined).toContain(
          `${L.maxKnowledgePiecesPerSpace} knowledge pieces / space`,
        );
      }

      if (L.deepDiveLimit > 0) {
        expect(texts.some((t) => t === "Deep dive analysis")).toBe(true);
      } else {
        expect(texts.some((t) => t === "Deep dive analysis")).toBe(false);
      }
    }
  });
});
