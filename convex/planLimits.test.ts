import { describe, expect, it } from "vitest";
import { getServerPlanLimitsForUser } from "./planLimits";
import { UNLIMITED_LIMIT } from "../shared/planConfig";

describe("getServerPlanLimitsForUser", () => {
  it("returns free tier limits when no features present", () => {
    const limits = getServerPlanLimitsForUser("user_123");
    expect(limits.maxSpaces).toBe(3);
    expect(limits.maxTestsPerMonth).toBe(10);
    expect(limits.maxKnowledgePiecesPerSpace).toBe(20);
  });

  it("basic_tests is treated as free tier (same limits)", () => {
    const limits = getServerPlanLimitsForUser("user_123", {
      basic_tests: true,
    });
    expect(limits.maxSpaces).toBe(3);
    expect(limits.maxTestsPerMonth).toBe(10);
    expect(limits.maxKnowledgePiecesPerSpace).toBe(20);
  });

  it("returns pro limits when pro feature is present", () => {
    const limits = getServerPlanLimitsForUser("user_123", { pro_tests: true });
    expect(limits.maxSpaces).toBe(UNLIMITED_LIMIT);
    expect(limits.maxTestsPerMonth).toBe(100);
    expect(limits.maxKnowledgePiecesPerSpace).toBe(200);
  });

  it("returns educator limits when unlimited feature is present", () => {
    const limits = getServerPlanLimitsForUser("user_123", {
      unlimited_ai_tests: true,
    });
    expect(limits.maxSpaces).toBe(UNLIMITED_LIMIT);
    expect(limits.maxTestsPerMonth).toBe(300);
    expect(limits.maxKnowledgePiecesPerSpace).toBe(UNLIMITED_LIMIT);
  });

  it("reads nested metadata flags", () => {
    const limits = getServerPlanLimitsForUser("user_123", {
      publicMetadata: { pro_tests: true },
    });
    expect(limits.maxTestsPerMonth).toBe(100);
    expect(limits.maxKnowledgePiecesPerSpace).toBe(200);
  });

  it("falls back to free limits for unknown flags", () => {
    const limits = getServerPlanLimitsForUser("user_123", {
      unknown_flag: true,
    });
    expect(limits.maxSpaces).toBe(3);
    expect(limits.maxTestsPerMonth).toBe(10);
    expect(limits.maxKnowledgePiecesPerSpace).toBe(20);
  });

  it("does not infer pro from unrelated substrings like profile/provider", () => {
    const limits = getServerPlanLimitsForUser("user_123", {
      profile: "student profile",
      provider: "clerk-provider",
    });
    expect(limits.maxSpaces).toBe(3);
    expect(limits.maxTestsPerMonth).toBe(10);
    expect(limits.maxKnowledgePiecesPerSpace).toBe(20);
  });

  it("detects explicit plan metadata values", () => {
    const limits = getServerPlanLimitsForUser("user_123", {
      publicMetadata: { plan: "pro" },
    });
    expect(limits.maxTestsPerMonth).toBe(100);
    expect(limits.maxKnowledgePiecesPerSpace).toBe(200);
  });

  it("ignores inherited prototype plan fields", () => {
    const proto = { plan: "pro" };
    const identity = Object.create(proto) as Record<string, unknown>;
    const limits = getServerPlanLimitsForUser("user_123", identity);
    expect(limits.maxSpaces).toBe(3);
    expect(limits.maxTestsPerMonth).toBe(10);
    expect(limits.maxKnowledgePiecesPerSpace).toBe(20);
  });

  it("does not infer pro from generic subscription strings", () => {
    const limits = getServerPlanLimitsForUser("user_123", {
      subscription: "pro",
    });
    expect(limits.maxSpaces).toBe(3);
    expect(limits.maxTestsPerMonth).toBe(10);
    expect(limits.maxKnowledgePiecesPerSpace).toBe(20);
  });

  it("supports explicit subscription tiers", () => {
    const limits = getServerPlanLimitsForUser("user_123", {
      publicMetadata: { subscriptionTier: "pro_scholar" },
    });
    expect(limits.maxSpaces).toBe(UNLIMITED_LIMIT);
    expect(limits.maxTestsPerMonth).toBe(100);
    expect(limits.maxKnowledgePiecesPerSpace).toBe(200);
  });

  it("does not infer paid tier from unrelated nested tier keys", () => {
    const limits = getServerPlanLimitsForUser("user_123", {
      risk: { tier: "pro" },
    });
    expect(limits.maxSpaces).toBe(3);
    expect(limits.maxTestsPerMonth).toBe(10);
    expect(limits.maxKnowledgePiecesPerSpace).toBe(20);
  });
});
