import { describe, it, expect } from "vitest";
import { requireFeatureEnabled, assertWithinLimit } from "./limitEnforcement";
import { UNLIMITED_LIMIT } from "../shared/planConfig";

describe("requireFeatureEnabled", () => {
  it("throws when limit is 0", () => {
    expect(() => requireFeatureEnabled(0, "test generation")).toThrow(
      "You don't have access to test generation on your current plan",
    );
  });

  it("passes when limit > 0", () => {
    expect(() => requireFeatureEnabled(5, "test generation")).not.toThrow();
  });

  it("passes when limit is UNLIMITED", () => {
    expect(() => requireFeatureEnabled(UNLIMITED_LIMIT, "spaces")).not.toThrow();
  });
});

describe("assertWithinLimit", () => {
  it("throws when count >= finite limit", () => {
    expect(() =>
      assertWithinLimit({ limit: 3, count: 3, noun: "tests", scope: "per month" }),
    ).toThrow("Limit reached: You can only have 3 tests per month on your current plan.");
  });

  it("throws when count exceeds limit", () => {
    expect(() =>
      assertWithinLimit({ limit: 5, count: 6, noun: "spaces" }),
    ).toThrow("Limit reached: You can only have 5 spaces on your current plan.");
  });

  it("passes when count < limit", () => {
    expect(() =>
      assertWithinLimit({ limit: 5, count: 4, noun: "tests", scope: "per month" }),
    ).not.toThrow();
  });

  it("passes when limit is UNLIMITED regardless of count", () => {
    expect(() =>
      assertWithinLimit({ limit: UNLIMITED_LIMIT, count: 9999, noun: "spaces" }),
    ).not.toThrow();
  });

  it("includes scope in message when provided", () => {
    try {
      assertWithinLimit({ limit: 10, count: 10, noun: "knowledge pieces", scope: "per space" });
      expect.fail("should have thrown");
    } catch (e) {
      expect((e as Error).message).toContain("per space");
    }
  });
});
