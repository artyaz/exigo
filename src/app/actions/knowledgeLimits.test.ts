import { describe, expect, it } from "vitest";
import { getMaxKnowledgePieces } from "./knowledgeLimits";
import { UNLIMITED_LIMIT } from "../../../shared/planConfig";

describe("getMaxKnowledgePieces", () => {
    it("returns UNLIMITED_LIMIT for educator tier", () => {
        expect(getMaxKnowledgePieces("educator-monthly")).toBe(UNLIMITED_LIMIT);
    });

    it("returns 200 for pro tier", () => {
        expect(getMaxKnowledgePieces("pro-monthly")).toBe(200);
    });

    it("returns 200 for pro-annual tier", () => {
        expect(getMaxKnowledgePieces("pro-annual")).toBe(200);
    });

    it("returns 20 for free tier", () => {
        expect(getMaxKnowledgePieces(undefined)).toBe(20);
    });
});
