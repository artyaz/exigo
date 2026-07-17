import { describe, it, expect } from "vitest";
import { validateSpec } from "./validate";

const base = () => ({
  type: "reactive",
  state: { n: 0 },
  display: [{ type: "stateBadge", label: "n", value: "n" }],
});

describe("validateSpec (§11 non-negotiables)", () => {
  it("accepts a minimal well-formed spec", () => {
    expect(validateSpec(base()).ok).toBe(true);
  });

  it("rejects lambdas in expressions", () => {
    const r = validateSpec({ ...base(), bindings: { f: "x => x" } });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.message.includes('Lambda'))).toBe(true);
  });

  it("rejects binding cycles", () => {
    const r = validateSpec({ ...base(), bindings: { a: "b", b: "a" } });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.message.includes('Binding cycle'))).toBe(true);
  });

  it("forbids time() inside a binding", () => {
    const r = validateSpec({ ...base(), bindings: { t: "time()" } });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.message.includes('time()'))).toBe(true);
  });

  it("forbids bindings reading the event payload", () => {
    const r = validateSpec({ ...base(), bindings: { x: "event.now" } });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.message.includes('event payload'))).toBe(true);
  });

  it("rejects a duplicate write in one reaction", () => {
    const r = validateSpec({
      ...base(),
      reactions: [{ on: "x", do: [{ set: "n", to: "1" }, { set: "n", to: "2" }] }],
    });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.message.includes('writes "n" twice'))).toBe(true);
  });

  it("rejects assigning an unknown state key", () => {
    const r = validateSpec({ ...base(), reactions: [{ on: "x", do: [{ set: "ghost", to: "1" }] }] });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.message.includes('unknown state key "ghost"'))).toBe(true);
  });

  it("rejects a slider whose value is a constant (the thumb can't be dragged)", () => {
    const r = validateSpec({
      type: "reactive",
      state: { step: 1 },
      reactions: [{ on: "stepChange", do: [{ set: "step", to: "event.value" }] }],
      display: [
        { type: "stateBadge", label: "s", value: "step" },
        { type: "controls", controls: [{ type: "slider", event: "stepChange", value: "1", min: 1, max: 8, step: 1 }] },
      ],
    });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.message.includes('slider\'s `value` must reference'))).toBe(true);
  });

  it("accepts a slider whose value is bound to state", () => {
    const r = validateSpec({
      type: "reactive",
      state: { step: 1 },
      reactions: [{ on: "stepChange", do: [{ set: "step", to: "event.value" }] }],
      display: [
        { type: "stateBadge", label: "s", value: "step" },
        { type: "controls", controls: [{ type: "slider", event: "stepChange", value: "step", min: 1, max: 8, step: 1 }] },
      ],
    });
    expect(r.ok).toBe(true);
  });

  it("rejects the canvasScene display layer", () => {
    const r = validateSpec({ ...base(), display: [{ type: "canvasScene" }] });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.message.includes('canvasScene'))).toBe(true);
  });

  it("rejects a codeProbe editMode incompatible with its harness kind", () => {
    const r = validateSpec({
      ...base(),
      display: [
        {
          type: "codeProbe",
          language: "rust",
          editMode: "multiRegionFreeText",
          harness: { id: "rust-ownership-move" },
          source: [{ kind: "locked", id: "l", text: "x" }],
        },
      ],
    });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.message.includes('incompatible'))).toBe(true);
  });

  it("accepts a codeProbe with a compatible editMode", () => {
    const r = validateSpec({
      ...base(),
      display: [
        {
          type: "codeProbe",
          language: "rust",
          editMode: "holes",
          harness: { id: "rust-ownership-move" },
          source: [
            { kind: "locked", id: "l", text: "x" },
            { kind: "blankHole", id: "h", placeholder: "?", maxChars: 4 },
          ],
        },
      ],
    });
    expect(r.ok).toBe(true);
  });

  it("rejects a display expression that reads an unknown ref", () => {
    const r = validateSpec({
      ...base(),
      display: [{ type: "numberLine", value: "ghost" }],
    });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.message.includes('Unknown reference `ghost`'))).toBe(true);
  });

  it("accepts display expressions over state, bindings and eval", () => {
    const r = validateSpec({
      ...base(),
      bindings: { dbl: "n * 2" },
      evaluator: { ok: "n == 1" },
      display: [
        { type: "numberLine", value: "dbl", target: "2" },
        { type: "controls", controls: [{ event: "inc", disabledWhen: "eval.ok" }] },
      ],
    });
    expect(r.ok).toBe(true);
  });

  it("rejects a diagramScene shape expr with an unknown ref", () => {
    const r = validateSpec({
      ...base(),
      display: [
        {
          type: "diagramScene",
          scene: { shapes: [{ type: "circle", cx: "nope", cy: "0.5", r: "0.1" }] },
        },
      ],
    });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.message.includes('Unknown reference `nope`'))).toBe(true);
  });

  it("rejects a choiceHole with no choices", () => {
    const r = validateSpec({
      ...base(),
      display: [
        {
          type: "codeProbe",
          language: "javascript",
          editMode: "holes",
          harness: { id: "js-real-execution" },
          source: [{ kind: "choiceHole", id: "c", choices: [] }],
        },
      ],
    });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.message.includes('at least one choice'))).toBe(true);
  });

  it("rejects editMode holes with no hole regions", () => {
    const r = validateSpec({
      ...base(),
      display: [
        {
          type: "codeProbe",
          language: "javascript",
          editMode: "holes",
          harness: { id: "js-real-execution" },
          source: [{ kind: "locked", id: "l", text: "x" }],
        },
      ],
    });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.message.includes('requires at least one hole'))).toBe(true);
  });

  it("reports time() in a binding exactly once", () => {
    const r = validateSpec({ ...base(), bindings: { t: "time()" } });
    expect(r.errors.filter((e) => e.path === "binding `t`").length).toBe(1);
  });

  it("flags evaluator reading the display-only `eval` alias", () => {
    const r = validateSpec({ ...base(), evaluator: { ok: "eval.ok" } });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.message.includes('Unknown reference `eval`'))).toBe(true);
  });
});

describe("v4 observation layers + schema check", () => {
  const withObs = (extra: Record<string, unknown>) => ({
    type: "reactive",
    state: { obs: [], runId: 0, stack: [] },
    display: [
      {
        type: "codeProbe",
        language: "javascript",
        editMode: "holes",
        harness: { id: "js-observation" },
        event: "ran",
        source: [
          { kind: "locked", id: "l", text: "enter('f', 1); exit('f', 1);" },
          { kind: "blankHole", id: "h", placeholder: "1", maxChars: 4 },
        ],
      },
    ],
    ...extra,
  });

  it("accepts a sequence + observationPlayer display", () => {
    const r = validateSpec(
      withObs({
        display: [
          { type: "sequence", items: "stack", cursor: "0", label: "stack" },
          { type: "observationPlayer", source: "obs", version: "runId", playback: { mode: "auto", fps: 2 } },
        ],
      }),
    );
    expect(r.ok).toBe(true);
  });

  it("rejects an unknown sequence ref and a bad playback mode", () => {
    const r = validateSpec(
      withObs({
        display: [
          { type: "sequence", items: "ghost" },
          { type: "observationPlayer", playback: { mode: "warp" } },
        ],
      }),
    );
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.message.includes('Unknown reference `ghost`'))).toBe(true);
    expect(r.errors.some((e) => /playback.mode/.test(e.path))).toBe(true);
  });

  it("accepts an obs:<kind> reaction reading schema fields", () => {
    const r = validateSpec(
      withObs({
        reactions: [
          { on: "obs:enter", do: [{ set: "stack", to: "push(stack, at(event.args, 0))" }] },
          { on: "obs:exit", do: [{ set: "stack", to: "removeLast(stack)" }] },
        ],
      }),
    );
    expect(r.ok).toBe(true);
  });

  it("rejects an obs:<kind> reaction reading a field the harness never emits", () => {
    const r = validateSpec(
      withObs({
        reactions: [{ on: "obs:enter", do: [{ set: "stack", to: "push(stack, event.depht)" }] }],
      }),
    );
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.message.includes('event.depht') && e.message.includes('enter'))).toBe(true);
  });
});

describe("structured surface + §12 graphical hard gate", () => {
  const staged = (over: Record<string, unknown> = {}) => ({
    type: "reactive",
    prompt: "Pack the buffer.",
    criticalThinking: "When is never-free the right trade?",
    state: { blocks: [] },
    stage: {
      type: "arena",
      regions: [{ id: "buf", capacity: 8 }],
      blocks: "blocks",
    },
    ...over,
  });

  it("accepts a well-formed staged spec", () => {
    const r = validateSpec(staged());
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("ERRORS when the stage is a text layer — text never carries an exercise", () => {
    const r = validateSpec(staged({ stage: { type: "richText", value: "lots of prose" } }));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.path === "spec.stage.type" && e.message.includes('rich visual'))).toBe(true);
  });

  it("ERRORS on a blown text budget (3 readouts) and a non-text readout", () => {
    const badge = { type: "stateBadge", label: "n", value: "len(blocks)" };
    const r = validateSpec(staged({ readouts: [badge, badge, badge] }));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.message.includes('Text budget'))).toBe(true);

    const r2 = validateSpec(staged({ readouts: [{ type: "graph", nodes: "blocks" }] }));
    expect(r2.ok).toBe(false);
    expect(r2.errors.some((e) => e.message.includes('quiet text layers'))).toBe(true);
  });

  it("ERRORS when prompt or criticalThinking is missing", () => {
    const r = validateSpec(staged({ prompt: undefined }));
    expect(r.errors.some((e) => e.path === "spec.prompt")).toBe(true);
    const r2 = validateSpec(staged({ criticalThinking: "  " }));
    expect(r2.errors.some((e) => e.path === "spec.criticalThinking")).toBe(true);
  });

  it("ERRORS when both stage and raw display[] are declared", () => {
    const r = validateSpec(staged({ display: [{ type: "stateBadge", label: "n", value: "len(blocks)" }] }));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.message.includes('not both'))).toBe(true);
  });

  it("validates expressions inside structured fields with their own paths", () => {
    const r = validateSpec(staged({ stage: { type: "arena", regions: [{ id: "buf" }], blocks: "ghost" } }));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.path.startsWith("spec.stage") && e.message.includes('Unknown reference `ghost`'))).toBe(true);
  });

  it("checks showWhen as a display expression", () => {
    const r = validateSpec(
      staged({ readouts: [{ type: "richText", value: "after", showWhen: "ghost" }] }),
    );
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.path.includes('showWhen'))).toBe(true);
  });

  it("warns (visualDensity), without rejecting, on a text-primary legacy display", () => {
    const r = validateSpec({
      type: "reactive",
      state: { n: 0 },
      display: [
        { type: "richText", value: "wall of text" },
        { type: "text", value: "more text" },
        { type: "text", value: "even more" },
      ],
    });
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.includes('no rich visual'))).toBe(true);
    expect(r.warnings.some((w) => w.includes('text is the primary display'))).toBe(true);
    expect(r.warnings.some((w) => w.includes('3 text layers'))).toBe(true);
  });

  it("ERRORS on a free-text codeProbe with nothing editable", () => {
    const r = validateSpec(
      staged({
        code: {
          type: "codeProbe",
          language: "javascript",
          harness: { id: "js-observation" },
          editMode: "multiRegionFreeText",
          source: [{ kind: "locked", id: "l1", text: "const x = 1;" }],
        },
      }),
    );
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.message.includes('editableText'))).toBe(true);
  });
});
