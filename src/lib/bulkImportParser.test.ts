import { describe, expect, it } from "vitest";
import {
    appearsToBeCsvWithWrongHeaders,
    parseCsvKnowledgePieces,
    parseDelimiterKnowledgePieces,
} from "./bulkImportParser";

describe("parseCsvKnowledgePieces", () => {
    it("parses csv rows with Content and Name headers", () => {
        const csv = [
            "Content,Name",
            "\"Cell biology basics\",Biology 101",
            "\"Line 1",
            "Line 2\",",
        ].join("\n");

        const pieces = parseCsvKnowledgePieces(csv, "CSV Upload");
        expect(pieces).toEqual([
            { content: "Cell biology basics", title: "Biology 101", source: "CSV Upload" },
            { content: "Line 1\nLine 2", title: undefined, source: "CSV Upload" },
        ]);
    });

    it("returns null when csv headers do not match required order", () => {
        const csv = "Name,Content\nIntro,Some content";
        expect(parseCsvKnowledgePieces(csv)).toBeNull();
    });

    it("skips rows with empty content", () => {
        const csv = "Content,Name\n,Ignore me\nValid content,Useful name";
        expect(parseCsvKnowledgePieces(csv)).toEqual([
            { content: "Valid content", title: "Useful name", source: undefined },
        ]);
    });
});

describe("parseDelimiterKnowledgePieces", () => {
    it("supports escaped newline delimiters", () => {
        const text = "First piece\n\nSecond piece\n\nThird piece";
        expect(parseDelimiterKnowledgePieces(text, String.raw`\n\n`)).toEqual([
            { content: "First piece", source: undefined },
            { content: "Second piece", source: undefined },
            { content: "Third piece", source: undefined },
        ]);
    });
});

describe("appearsToBeCsvWithWrongHeaders", () => {
    it("detects csv-like input with wrong header order", () => {
        expect(appearsToBeCsvWithWrongHeaders("Name,Content\nA,B")).toBe(true);
    });

    it("does not flag plain text input", () => {
        expect(appearsToBeCsvWithWrongHeaders("Random note, no csv header")).toBe(false);
    });
});
