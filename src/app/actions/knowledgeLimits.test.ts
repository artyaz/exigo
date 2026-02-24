import { describe, expect, it } from "vitest";
import { getMaxKnowledgePieces } from "./knowledgeLimits";
import { UNLIMITED_LIMIT } from "../../../shared/planConfig";

describe("getMaxKnowledgePieces", () => {
    it("returns UNLIMITED_LIMIT for unlimited tier", () => {
        const has = ({ feature }: { feature: string }) => feature === "unlimited_knowledge";
        expect(getMaxKnowledgePieces(has)).toBe(UNLIMITED_LIMIT);
    });

    it("returns 200 for pro tier", () => {
        const has = ({ feature }: { feature: string }) => feature === "pro_knowledge";
        expect(getMaxKnowledgePieces(has)).toBe(200);
    });

    it("returns 50 for basic tier", () => {
        const has = ({ feature }: { feature: string }) => feature === "basic_knowledge";
        expect(getMaxKnowledgePieces(has)).toBe(50);
    });

    it("returns 20 for free tier", () => {
        const has = () => false;
        expect(getMaxKnowledgePieces(has)).toBe(20);
    });
});
