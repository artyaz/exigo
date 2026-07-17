import { describe, it, expect } from "vitest";
import {
  getLimitsForAccessLevel,
  parseSlugToAccessLevel,
  isProOrHigher,
  normalizeAccessLevel,
  ACCESS_LEVELS,
} from "./subscriptionService";
import {
  UNLIMITED_LIMIT,
  MAX_TESTS_SENTINEL,
  LIMITS_BY_TIER,
} from "../shared/planConfig";

/**
 * Honest pure-unit coverage for plan limit helpers used by production
 * mutations (spaces, tests, knowledgePieces). No local shadow handlers —
 * those previously claimed to "enforce limits" while never importing prod code.
 */

describe("limit helpers — access levels & plan slugs", () => {
  it("maps free/undefined/unknown slugs to FREE access", () => {
    expect(parseSlugToAccessLevel(undefined)).toBe(ACCESS_LEVELS.FREE);
    expect(parseSlugToAccessLevel("free")).toBe(ACCESS_LEVELS.FREE);
    expect(parseSlugToAccessLevel("not-a-real-plan")).toBe(ACCESS_LEVELS.FREE);
  });

  it("maps pro and educator billing slugs", () => {
    expect(parseSlugToAccessLevel("pro-monthly")).toBe(ACCESS_LEVELS.PRO_SCHOLAR);
    expect(parseSlugToAccessLevel("pro-annual")).toBe(ACCESS_LEVELS.PRO_SCHOLAR);
    expect(parseSlugToAccessLevel("educator-monthly")).toBe(ACCESS_LEVELS.EDUCATOR);
    expect(parseSlugToAccessLevel("educator-annual")).toBe(ACCESS_LEVELS.EDUCATOR);
  });

  it("isProOrHigher is false for free, true for pro and educator", () => {
    expect(isProOrHigher(ACCESS_LEVELS.FREE)).toBe(false);
    expect(isProOrHigher(ACCESS_LEVELS.PRO_SCHOLAR)).toBe(true);
    expect(isProOrHigher(ACCESS_LEVELS.EDUCATOR)).toBe(true);
  });

  it("normalizeAccessLevel clamps invalid levels to FREE", () => {
    expect(normalizeAccessLevel(ACCESS_LEVELS.PRO_SCHOLAR)).toBe(
      ACCESS_LEVELS.PRO_SCHOLAR,
    );
    expect(normalizeAccessLevel(-1)).toBe(ACCESS_LEVELS.FREE);
    expect(normalizeAccessLevel(99)).toBe(ACCESS_LEVELS.FREE);
  });
});

describe("limit helpers — free tier boundaries", () => {
  const free = getLimitsForAccessLevel(ACCESS_LEVELS.FREE);

  it("free plan: 3 spaces, 3 tests/month, 20 knowledge pieces/space", () => {
    expect(free).toEqual(LIMITS_BY_TIER.free);
    expect(free.maxSpaces).toBe(3);
    expect(free.maxTestsPerMonth).toBe(3);
    expect(free.maxKnowledgePiecesPerSpace).toBe(20);
  });

  it("free test monthly boundary is 3, not a fictional higher cap", () => {
    // Ghost suite used to "block" after 10 tests while free limit is 3.
    expect(free.maxTestsPerMonth).toBe(3);
    const atLimit = 3;
    const overLimit = 4;
    expect(atLimit >= free.maxTestsPerMonth).toBe(true);
    expect(overLimit > free.maxTestsPerMonth).toBe(true);
  });
});

describe("limit helpers — paid tiers & unlimited sentinel", () => {
  it("pro: unlimited spaces, finite tests and knowledge pieces", () => {
    const pro = getLimitsForAccessLevel(ACCESS_LEVELS.PRO_SCHOLAR);
    expect(pro).toEqual(LIMITS_BY_TIER.pro);
    expect(pro.maxSpaces).toBe(UNLIMITED_LIMIT);
    expect(pro.maxTestsPerMonth).toBe(100);
    expect(pro.maxKnowledgePiecesPerSpace).toBe(200);
  });

  it("educator: unlimited spaces and knowledge pieces; finite tests under sentinel", () => {
    const edu = getLimitsForAccessLevel(ACCESS_LEVELS.EDUCATOR);
    expect(edu).toEqual(LIMITS_BY_TIER.educator);
    expect(edu.maxSpaces).toBe(UNLIMITED_LIMIT);
    expect(edu.maxKnowledgePiecesPerSpace).toBe(UNLIMITED_LIMIT);
    expect(edu.maxTestsPerMonth).toBe(300);
    expect(edu.maxTestsPerMonth).toBeLessThanOrEqual(MAX_TESTS_SENTINEL);
  });

  it("slug → limits composition matches access-level lookup", () => {
    const viaSlug = getLimitsForAccessLevel(
      parseSlugToAccessLevel("pro-monthly"),
    );
    const viaLevel = getLimitsForAccessLevel(ACCESS_LEVELS.PRO_SCHOLAR);
    expect(viaSlug).toEqual(viaLevel);
  });
});
