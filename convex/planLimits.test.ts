import { describe, expect, it } from "vitest";
import {
  getLimitsForAccessLevel,
  parseSlugToAccessLevel,
  ACCESS_LEVELS,
} from "./subscriptionService";
import { UNLIMITED_LIMIT } from "../shared/planConfig";

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

describe("getLimitsForAccessLevel", () => {
  it("returns free tier limits", () => {
    const limits = getLimitsForAccessLevel(ACCESS_LEVELS.FREE);
    expect(limits.maxSpaces).toBe(3);
    expect(limits.maxTestsPerMonth).toBe(10);
    expect(limits.maxKnowledgePiecesPerSpace).toBe(20);
  });

  it("returns pro tier limits", () => {
    const limits = getLimitsForAccessLevel(ACCESS_LEVELS.PRO_SCHOLAR);
    expect(limits.maxSpaces).toBe(UNLIMITED_LIMIT);
    expect(limits.maxTestsPerMonth).toBe(100);
    expect(limits.maxKnowledgePiecesPerSpace).toBe(200);
  });

  it("returns educator tier limits", () => {
    const limits = getLimitsForAccessLevel(ACCESS_LEVELS.EDUCATOR);
    expect(limits.maxSpaces).toBe(UNLIMITED_LIMIT);
    expect(limits.maxTestsPerMonth).toBe(300);
    expect(limits.maxKnowledgePiecesPerSpace).toBe(UNLIMITED_LIMIT);
  });
});
