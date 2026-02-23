import { describe, expect, it } from "vitest";
import { getServerPlanLimitsForUser } from "./planLimits";

describe("getServerPlanLimitsForUser", () => {
    it("returns finite, server-side limits", () => {
        const limits = getServerPlanLimitsForUser("user_123");
        expect(limits.maxSpaces).toBe(3);
        expect(limits.maxTestsPerMonth).toBe(10);
        expect(limits.maxKnowledgePiecesPerSpace).toBe(20);
    });
});
