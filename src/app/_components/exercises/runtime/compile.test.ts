import { describe, it, expect } from "vitest";
import { compileDisplay } from "./compile";
import type { ReactiveSpec } from "./types";

describe("compileDisplay (structured surface → display[])", () => {
  const spec: ReactiveSpec = {
    type: "reactive",
    prompt: "p",
    criticalThinking: "Why does it overflow?",
    state: { blocks: [] },
    code: {
      type: "codeProbe",
      language: "javascript",
      harness: { id: "js-observation" },
      editMode: "multiRegionFreeText",
      source: [{ kind: "editableText", id: "b", initial: "x", maxChars: 100 }],
    },
    stage: { type: "arena", regions: [{ id: "buf", capacity: 8 }], blocks: "blocks" },
    readouts: [{ type: "stateBadge", label: "n", value: "len(blocks)" }],
    player: { type: "observationPlayer", source: "blocks" },
  };

  it("lowers in canonical order: code → stage → readouts → player → reveal", () => {
    const layers = compileDisplay(spec);
    expect(layers.map((l) => l.type)).toEqual([
      "codeProbe",
      "arena",
      "stateBadge",
      "observationPlayer",
      "richText",
    ]);
  });

  it("compiles criticalThinking into a solve-gated richText", () => {
    const reveal = compileDisplay(spec).at(-1)!;
    expect(reveal.showWhen).toBe("eval.ok");
    expect(reveal.type === "richText" && String(reveal.value)).toContain("Why does it overflow?");
  });

  it("passes a legacy display[] through untouched", () => {
    const legacy: ReactiveSpec = {
      type: "reactive",
      state: {},
      display: [{ type: "text", value: "hi" }],
    };
    expect(compileDisplay(legacy)).toEqual([{ type: "text", value: "hi" }]);
    expect(compileDisplay({ type: "reactive", state: {} })).toEqual([]);
  });
});
