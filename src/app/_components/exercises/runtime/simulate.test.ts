/* The simulator is the "is it actually playable" guarantee. These pin the
   cases that matter: a reachable goal passes, an unreachable or source-less
   goal fails (the exact shape of the broken sales exercise), dead controls are
   flagged, and code exercises are left to the static checks. */
import { describe, it, expect } from "vitest";
import { checkPlayable } from "./simulate";
import type { ReactiveSpec } from "./types";
import { parseMarkup } from "../markup/parse";
import { NOCODE_EXEMPLAR } from "../generate/exemplar";

const base = { type: "reactive" as const, evaluatePolicy: { onEvent: true, onSubmit: false } };

describe("checkPlayable", () => {
  it("passes a winnable exercise (drive a counter to 5)", () => {
    const spec: ReactiveSpec = {
      ...base,
      state: { n: 0 },
      reactions: [{ on: "inc", do: [{ set: "n", to: "min(n + 1, 9)" }] }],
      evaluator: { ok: "n == 5" },
      controls: { type: "controls", controls: [{ type: "button", event: "inc", label: "+1" }] },
    };
    const r = checkPlayable(spec);
    expect(r.errors).toEqual([]);
    expect(r.winnable).toBe(true);
  });

  it("rejects a goal with no control to reach it (the broken-sales shape)", () => {
    const spec: ReactiveSpec = {
      ...base,
      state: { correctCount: 0 },
      reactions: [{ on: "move", allowSequentialWrite: true, do: [{ set: "correctCount", to: "correctCount + 1" }] }],
      evaluator: { ok: "correctCount == 6" },
      // no <controls> — nothing dispatches "move"
    };
    const r = checkPlayable(spec);
    expect(r.winnable).toBe(false);
    expect(r.errors.join(" ")).toMatch(/can't be played|no <controls>/i);
  });

  it("rejects an unwinnable exercise (control can't reach the goal)", () => {
    const spec: ReactiveSpec = {
      ...base,
      state: { n: 0 },
      reactions: [{ on: "inc", do: [{ set: "n", to: "min(n + 1, 3)" }] }],
      evaluator: { ok: "n == 5" }, // capped at 3, never 5
      controls: { type: "controls", controls: [{ type: "button", event: "inc", label: "+1" }] },
    };
    const r = checkPlayable(spec);
    expect(r.winnable).toBe(false);
    expect(r.errors.join(" ")).toMatch(/can't be won/i);
  });

  it("flags a dead control while still winning", () => {
    const spec: ReactiveSpec = {
      ...base,
      state: { n: 0 },
      reactions: [{ on: "inc", do: [{ set: "n", to: "min(n + 1, 9)" }] }],
      evaluator: { ok: "n == 5" },
      controls: {
        type: "controls",
        controls: [
          { type: "button", event: "inc", label: "+1" },
          { type: "button", event: "noop", label: "does nothing" },
        ],
      },
    };
    const r = checkPlayable(spec);
    expect(r.winnable).toBe(true);
    expect(r.warnings.join(" ")).toMatch(/does nothing|never changes/i);
  });

  it("leaves code exercises to the static checks (no false negative)", () => {
    const spec: ReactiveSpec = {
      ...base,
      state: { passed: false },
      reactions: [{ on: "ran", do: [{ set: "passed", to: "event.ok" }] }],
      evaluator: { ok: "passed" },
      code: {
        type: "codeProbe",
        language: "javascript",
        harness: { id: "js-real-execution" },
        editMode: "holes",
        source: [{ kind: "locked", id: "l", text: "x" }],
      },
    };
    const r = checkPlayable(spec);
    expect(r.errors).toEqual([]);
    expect(r.winnable).toBe(true);
  });

  it("confirms the no-code exemplar is winnable", () => {
    const { spec } = parseMarkup(NOCODE_EXEMPLAR);
    const r = checkPlayable(spec!);
    expect(r.errors).toEqual([]);
    expect(r.winnable).toBe(true);
  });
});
