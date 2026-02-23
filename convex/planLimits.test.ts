import { describe, expect, it } from "vitest";
import { getServerPlanLimitsForUser } from "./planLimits";

describe("getServerPlanLimitsForUser", () => {
    it("returns finite, server-side limits", () => {
        const limits = getServerPlanLimitsForUser("user_123");
        expect(limits.maxSpaces).toBe(3);
        expect(limits.maxTestsPerMonth).toBe(10);
        expect(limits.maxKnowledgePiecesPerSpace).toBe(20);
    });

    it("returns basic limits when basic feature is present", () => {
        const limits = getServerPlanLimitsForUser("user_123", { basic_tests: true });
        expect(limits.maxKnowledgePiecesPerSpace).toBe(50);
    });

    it("returns pro limits when pro feature is present", () => {
        const limits = getServerPlanLimitsForUser("user_123", { pro_tests: true });
        expect(limits.maxTestsPerMonth).toBe(100);
        expect(limits.maxKnowledgePiecesPerSpace).toBe(200);
    });

    it("returns educator limits when unlimited feature is present", () => {
        const limits = getServerPlanLimitsForUser("user_123", { unlimited_ai_tests: true });
        expect(limits.maxSpaces).toBe(Number.MAX_SAFE_INTEGER);
        expect(limits.maxTestsPerMonth).toBe(300);
        expect(limits.maxKnowledgePiecesPerSpace).toBe(Number.MAX_SAFE_INTEGER);
    });

    it("reads nested metadata flags", () => {
        const limits = getServerPlanLimitsForUser("user_123", { publicMetadata: { pro_tests: true } });
        expect(limits.maxTestsPerMonth).toBe(100);
        expect(limits.maxKnowledgePiecesPerSpace).toBe(200);
    });

    it("falls back to free limits for unknown flags", () => {
        const limits = getServerPlanLimitsForUser("user_123", { unknown_flag: true });
        expect(limits.maxSpaces).toBe(3);
        expect(limits.maxTestsPerMonth).toBe(10);
        expect(limits.maxKnowledgePiecesPerSpace).toBe(20);
    });
});
