import { describe, expect, it } from "vitest";
import { getSpaceLimit } from "./spaceLimits";
import { UNLIMITED_LIMIT } from "../../shared/planConfig";

function createHas(features: string[]) {
    return ({ feature }: { feature: string }) => features.includes(feature);
}

describe("getSpaceLimit", () => {
    it("returns 3 for free", () => {
        expect(getSpaceLimit(createHas([]))).toBe(3);
    });

    it("returns 3 for basic", () => {
        expect(getSpaceLimit(createHas(["basic_tests"]))).toBe(3);
    });

    it("returns unlimited for pro", () => {
        expect(getSpaceLimit(createHas(["pro_tests"]))).toBe(UNLIMITED_LIMIT);
    });

    it("returns unlimited for educator", () => {
        expect(getSpaceLimit(createHas(["unlimited_ai_tests"]))).toBe(UNLIMITED_LIMIT);
    });
});
