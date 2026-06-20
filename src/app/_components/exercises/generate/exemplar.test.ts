/* The exemplar is the constructor's few-shot — the model copies its shape. A
   broken example would teach broken output, so it must always parse + validate,
   and it must actually demonstrate the structures weak models get wrong. */
import { describe, it, expect } from "vitest";
import { parseMarkup } from "../markup/parse";
import { validateSpec } from "../runtime/validate";
import { checkPlayable } from "../runtime/simulate";
import { MARKUP_EXEMPLAR, NOCODE_EXEMPLAR } from "./exemplar";

describe("MARKUP_EXEMPLAR", () => {
  it("parses to a spec with no markup errors", () => {
    const { spec, errors } = parseMarkup(MARKUP_EXEMPLAR);
    expect(errors).toEqual([]);
    expect(spec).toBeDefined();
  });

  it("passes the validator cleanly", () => {
    const { spec } = parseMarkup(MARKUP_EXEMPLAR);
    expect(validateSpec(spec!).errors).toEqual([]);
  });

  it("demonstrates the exact structures models flatten or mistranslate", () => {
    const { spec } = parseMarkup(MARKUP_EXEMPLAR);
    // <think> present, <ok>/<no> nested in <goal>, state declared (not empty).
    expect(spec!.criticalThinking).toBeTruthy();
    expect(spec!.evaluator?.msgOk).toBeTruthy();
    expect(spec!.evaluator?.msgNo).toBeTruthy();
    expect(Object.keys(spec!.state)).toEqual(expect.arrayContaining(["obs", "blocks", "bufUsed", "heapCount", "runId"]));
    // reaction uses <set> children + the bare `seq` flag.
    const seqReaction = spec!.reactions?.find((r) => r.allowSequentialWrite);
    expect(seqReaction).toBeDefined();
  });
});

describe("NOCODE_EXEMPLAR (the default, code-free shape)", () => {
  it("parses with no markup errors", () => {
    const { spec, errors } = parseMarkup(NOCODE_EXEMPLAR);
    expect(errors).toEqual([]);
    expect(spec).toBeDefined();
  });

  it("passes the validator cleanly", () => {
    const { spec } = parseMarkup(NOCODE_EXEMPLAR);
    expect(validateSpec(spec!).errors).toEqual([]);
  });

  it("has NO code probe and drives interaction through controls", () => {
    const { spec } = parseMarkup(NOCODE_EXEMPLAR);
    expect(spec!.code).toBeUndefined();
    expect(spec!.controls?.controls.length).toBeGreaterThan(0);
    // button payload (choice) is carried as an expression
    const btn = spec!.controls!.controls[0]!;
    expect(btn.payload?.choice).toBeDefined();
  });

  it("is actually PLAYABLE — a learner can reach the goal", () => {
    const { spec } = parseMarkup(NOCODE_EXEMPLAR);
    const r = checkPlayable(spec!);
    expect(r.errors).toEqual([]);
    expect(r.winnable).toBe(true);
  });
});
