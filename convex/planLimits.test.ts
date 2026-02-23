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
});
