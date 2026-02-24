import { describe, expect, it } from "vitest";
import { getKnowledgePieceLimit } from "./knowledgePieceLimits";

function createHas(features: string[]) {
    return ({ feature }: { feature: string }) => features.includes(feature);
}

describe("getKnowledgePieceLimit", () => {
    it("returns 20 for free", () => {
        expect(getKnowledgePieceLimit(createHas([]))).toBe(20);
    });

    it("returns 50 for basic", () => {
        expect(getKnowledgePieceLimit(createHas(["basic_knowledge"]))).toBe(50);
    });

    it("returns 200 for pro", () => {
        expect(getKnowledgePieceLimit(createHas(["pro_knowledge"]))).toBe(200);
    });

    it("returns unlimited for educator", () => {
        expect(getKnowledgePieceLimit(createHas(["unlimited_knowledge"]))).toBe(Number.MAX_SAFE_INTEGER);
    });
});
