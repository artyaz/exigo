import { describe, expect, it } from "vitest";
import { getSpaceLimit } from "./spaceLimits";
import { UNLIMITED_LIMIT } from "../../shared/planConfig";

describe("getSpaceLimit", () => {
    it("returns 3 for free", () => {
        expect(getSpaceLimit(undefined)).toBe(3);
    });

    it("returns 3 for free plan slug", () => {
        expect(getSpaceLimit("free")).toBe(3);
    });

    it("returns unlimited for pro", () => {
        expect(getSpaceLimit("pro-monthly")).toBe(UNLIMITED_LIMIT);
    });

    it("returns unlimited for pro-annual", () => {
        expect(getSpaceLimit("pro-annual")).toBe(UNLIMITED_LIMIT);
    });

    it("returns unlimited for educator", () => {
        expect(getSpaceLimit("educator-monthly")).toBe(UNLIMITED_LIMIT);
    });
});
