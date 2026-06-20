import { describe, it, expect } from "vitest";
import { PRESETS } from "./presets";
import {
  validateSpec,
  compileDisplay,
  ReactiveVM,
  getHarness,
  isObservationHarness,
  type CodeRegion,
  type DisplayLayer,
  type ReactiveSpec,
  type RuntimeEvent,
  type Value,
} from "../_components/exercises";

const ev = (type: string, payload: Record<string, unknown> = {}): RuntimeEvent => ({
  type,
  payload: payload as RuntimeEvent["payload"],
  timestamp: 0,
});

/** Assemble a codeProbe's source, filling every blankHole with `fill`. */
function assemble(regions: CodeRegion[], fill: string): string {
  return regions
    .map((r) => {
      switch (r.kind) {
        case "locked":
          return r.text;
        case "blankHole":
          return fill;
        case "editableText":
          return r.initial;
        case "choiceHole":
          return r.choices[0]?.text ?? "";
      }
    })
    .join("");
}

function codeProbeOf(spec: ReactiveSpec): Extract<DisplayLayer, { type: "codeProbe" }> {
  const layer = compileDisplay(spec).find((d) => d.type === "codeProbe");
  if (!layer || layer.type !== "codeProbe") throw new Error("no codeProbe layer");
  return layer;
}

describe("playground presets", () => {
  it("every preset validates clean (§11)", () => {
    for (const p of PRESETS) {
      const r = validateSpec(p.spec);
      expect(r.ok, `${p.id}: ${r.errors.map((e) => e.message).join("; ")}`).toBe(true);
    }
  });
});

describe("recursion (observed) — end-to-end fold", () => {
  const preset = PRESETS.find((p) => p.id === "recursion-obs");

  it("is registered", () => {
    expect(preset).toBeDefined();
  });

  /** Run the harness for a given base value and fold the stream through the VM. */
  async function play(fill: string): Promise<{ vm: ReactiveVM; peakDepth: number; observations: Value[] }> {
    const spec = preset!.spec;
    const probe = codeProbeOf(spec);
    const harness = getHarness(probe.harness.id);
    if (!isObservationHarness(harness)) throw new Error("expected observation harness");

    const source = assemble(probe.source, fill);
    const runRes = await harness.runObservations(source);
    expect(runRes.ok).toBe(true);

    const vm = new ReactiveVM(spec);
    // The codeProbe dispatches its `event` with the observation stream.
    vm.dispatch(ev("ran", { ok: runRes.ok, error: runRes.error, log: runRes.log, observations: runRes.observations }));

    // Fold each observation as the player would, tracking how deep the stack gets.
    let peakDepth = 0;
    for (const o of runRes.observations) {
      const snap = vm.dispatch(ev(`obs:${o.kind}`, o));
      const stack = snap.state.stack as Value[];
      peakDepth = Math.max(peakDepth, Array.isArray(stack) ? stack.length : 0);
    }
    return { vm, peakDepth, observations: runRes.observations as unknown as Value[] };
  }

  it("base = 1 → 5 frames in, 5 out, fact(5) = 120, evaluator solves", async () => {
    const { vm, peakDepth } = await play("1");
    expect(peakDepth).toBe(5); // stack grows to depth 5 at the bottom of the recursion
    expect((vm.state.stack as Value[]).length).toBe(0); // …and fully unwinds
    expect(vm.evalResult?.ok).toBe(true);
    expect(vm.solved).toBe(true);
  });

  it("base = 2 → fact(5) ≠ 120, evaluator stays unsolved", async () => {
    const { vm, peakDepth } = await play("2");
    expect(peakDepth).toBe(5); // same call shape…
    expect(vm.evalResult?.ok).toBe(false); // …but the returned value is wrong
    expect(vm.solved).toBe(false);
  });

  it("play:reset clears the folded stack (scrub-back support)", async () => {
    const { vm } = await play("1");
    const snap = vm.dispatch(ev("play:reset"));
    expect((snap.state.stack as Value[]).length).toBe(0);
  });
});

describe("pmr arena (observed) — monotonic spill folds into the arena model", () => {
  const preset = PRESETS.find((p) => p.id === "pmr-arena");

  it("is registered", () => {
    expect(preset).toBeDefined();
  });

  /** Assemble the probe with a custom editable body, run, and fold the
      alloc stream through the VM exactly as the player would. */
  async function play(body: string): Promise<{ vm: ReactiveVM; heap: number; bufUsed: number; blocks: number }> {
    const spec = preset!.spec;
    const probe = codeProbeOf(spec);
    const harness = getHarness(probe.harness.id);
    if (!isObservationHarness(harness)) throw new Error("expected observation harness");

    const source = probe.source
      .map((r) => (r.kind === "locked" ? r.text : r.kind === "editableText" ? body : ""))
      .join("");
    const runRes = await harness.runObservations(source);
    expect(runRes.ok, runRes.error ?? "").toBe(true);

    const vm = new ReactiveVM(spec);
    vm.dispatch(ev("ran", { ok: runRes.ok, error: runRes.error, log: runRes.log, observations: runRes.observations }));
    for (const o of runRes.observations) vm.dispatch(ev(`obs:${o.kind}`, o));

    return {
      vm,
      heap: vm.state.heapCount as number,
      bufUsed: vm.state.bufUsed as number,
      blocks: (vm.state.blocks as Value[]).length,
    };
  }

  it("doubling growth leaves dead blocks and spills the live 128 B to the heap (unsolved)", async () => {
    const body =
      'reserve("cap=2", 8);\nreserve("cap=4", 16);\nreserve("cap=8", 32);\nreserve("cap=16", 64);\nreserve("cap=32", 128);\n';
    const { vm, heap, bufUsed, blocks } = await play(body);
    expect(blocks).toBe(5);
    expect(bufUsed).toBe(120); // 8+16+32+64 dead reallocations fill the buffer
    expect(heap).toBe(1); // …so the 128 B block can't fit and escapes
    expect(vm.solved).toBe(false);
  });

  it("reserving the final size up front fits with zero churn (solved)", async () => {
    const { vm, heap, bufUsed, blocks } = await play('reserve("reserved", 128);\n');
    expect(blocks).toBe(1);
    expect(heap).toBe(0);
    expect(bufUsed).toBe(128);
    expect(vm.solved).toBe(true);
  });
});

describe("cost curve (observed) — emit:point folds into the plot series", () => {
  const preset = PRESETS.find((p) => p.id === "cost-curve");

  it("is registered", () => {
    expect(preset).toBeDefined();
  });

  /** Assemble the probe with a custom cost body, run, and fold the point
      stream through the VM exactly as the player would. */
  async function play(costBody: string): Promise<{ vm: ReactiveVM; peak: number; samples: number }> {
    const spec = preset!.spec;
    const probe = codeProbeOf(spec);
    const harness = getHarness(probe.harness.id);
    if (!isObservationHarness(harness)) throw new Error("expected observation harness");

    const source = probe.source
      .map((r) => (r.kind === "locked" ? r.text : r.kind === "editableText" ? costBody : ""))
      .join("");
    const runRes = await harness.runObservations(source);
    expect(runRes.ok, runRes.error ?? "").toBe(true);

    const vm = new ReactiveVM(spec);
    vm.dispatch(ev("ran", { ok: runRes.ok, error: runRes.error, log: runRes.log, observations: runRes.observations }));
    for (const o of runRes.observations) vm.dispatch(ev(`obs:${o.kind}`, o));

    return { vm, peak: vm.state.peak as number, samples: (vm.state.samples as Value[]).length };
  }

  it("quadratic cost blows the budget (peak 64 > 48, unsolved)", async () => {
    const { vm, peak, samples } = await play("function cost(n) { return n * n; }\n");
    expect(samples).toBe(8); // one point per n = 1..8
    expect(peak).toBe(64); // cost(8) = 64
    expect(vm.solved).toBe(false);
  });

  it("linear cost sits exactly on budget (peak 48, solved)", async () => {
    const { vm, peak, samples } = await play("function cost(n) { return n * 6; }\n");
    expect(samples).toBe(8);
    expect(peak).toBe(48); // cost(8) = 48 == budget
    expect(vm.solved).toBe(true);
  });

  it("sub-linear cost is comfortably under budget (peak 8, solved)", async () => {
    const { vm, peak } = await play("function cost(n) { return n; }\n");
    expect(peak).toBe(8);
    expect(vm.solved).toBe(true);
  });
});

describe("recursion call tree (observed) — enters grow it, exits re-tone it", () => {
  const preset = PRESETS.find((p) => p.id === "recursion-graph");

  it("is registered", () => {
    expect(preset).toBeDefined();
  });

  interface TreeNode {
    id: string;
    label: string;
    tone: string;
  }

  /** Fill the base-case hole, run, and fold the enter/exit stream. */
  async function play(fill: string): Promise<{ vm: ReactiveVM; nodes: TreeNode[]; edges: Value[]; result: number }> {
    const spec = preset!.spec;
    const probe = codeProbeOf(spec);
    const harness = getHarness(probe.harness.id);
    if (!isObservationHarness(harness)) throw new Error("expected observation harness");

    const runRes = await harness.runObservations(assemble(probe.source, fill));
    expect(runRes.ok, runRes.error ?? "").toBe(true);

    const vm = new ReactiveVM(spec);
    vm.dispatch(ev("ran", { ok: runRes.ok, error: runRes.error, log: runRes.log, observations: runRes.observations }));
    for (const o of runRes.observations) vm.dispatch(ev(`obs:${o.kind}`, o));

    return {
      vm,
      nodes: vm.state.nodes as unknown as TreeNode[],
      edges: vm.state.edges as Value[],
      result: vm.state.result as number,
    };
  }

  it("base = 1 → a 5-frame chain, every frame re-toned ok on exit, solved", async () => {
    const { vm, nodes, edges, result } = await play("1");
    expect(nodes.map((n) => n.label)).toEqual(["fact(5)", "fact(4)", "fact(3)", "fact(2)", "fact(1)"]);
    expect(nodes.every((n) => n.tone === "ok")).toBe(true); // the unwind cascade completed
    expect(edges).toHaveLength(4); // f1→f2→…→f5
    expect(result).toBe(120);
    expect(vm.solved).toBe(true);
  });

  it("base = 2 → same tree shape but the wrong value flows up (unsolved)", async () => {
    const { vm, nodes, result } = await play("2");
    expect(nodes).toHaveLength(5);
    expect(result).toBe(240);
    expect(vm.solved).toBe(false);
  });
});
