import { describe, expect, it } from "vitest";
import { getKnowledgePieceLimit } from "./knowledgePieceLimits";
import { UNLIMITED_LIMIT } from "../../shared/planConfig";

describe("getKnowledgePieceLimit", () => {
    it("returns 20 for free", () => {
        expect(getKnowledgePieceLimit(undefined)).toBe(20);
    });

    it("returns 20 for free plan slug", () => {
        expect(getKnowledgePieceLimit("free")).toBe(20);
    });

    it("returns 200 for pro", () => {
        expect(getKnowledgePieceLimit("pro-monthly")).toBe(200);
        expect(getKnowledgePieceLimit("pro-annual")).toBe(200);
    });

    it("returns unlimited for educator", () => {
        expect(getKnowledgePieceLimit("educator-monthly")).toBe(UNLIMITED_LIMIT);
        expect(getKnowledgePieceLimit("educator-annual")).toBe(UNLIMITED_LIMIT);
    });
});
