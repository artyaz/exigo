import { describe, expect, it } from "vitest";
import { getKnowledgePieceLimit } from "./knowledgePieceLimits";
import { UNLIMITED_LIMIT } from "../../shared/planConfig";

function createHas(features: string[]) {
    return ({ feature }: { feature: string }) => features.includes(feature);
}

describe("getKnowledgePieceLimit", () => {
    it("returns 20 for free", () => {
        expect(getKnowledgePieceLimit(createHas([]))).toBe(20);
    });

    it("returns 50 for basic", () => {
        expect(getKnowledgePieceLimit(createHas(["basic_knowledge"]))).toBe(50);
        expect(getKnowledgePieceLimit(createHas(["basic_tests"]))).toBe(50);
    });

    it("returns 200 for pro", () => {
        expect(getKnowledgePieceLimit(createHas(["pro_knowledge"]))).toBe(200);
        expect(getKnowledgePieceLimit(createHas(["pro_tests"]))).toBe(200);
    });

    it("returns unlimited for educator", () => {
        expect(getKnowledgePieceLimit(createHas(["unlimited_knowledge"]))).toBe(UNLIMITED_LIMIT);
        expect(getKnowledgePieceLimit(createHas(["unlimited_ai_tests"]))).toBe(UNLIMITED_LIMIT);
    });
});
