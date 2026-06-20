import { describe, it, expect } from "vitest";
import { ReactiveVM, VMError, bindingOrder } from "./vm";
import type { ReactiveSpec, RuntimeEvent } from "./types";

const ev = (type: string, payload: Record<string, unknown> = {}): RuntimeEvent => ({
  type,
  payload: payload as RuntimeEvent["payload"],
  timestamp: 0,
});

describe("ReactiveVM", () => {
  it("reads a frozen pre-reaction snapshot so writes are atomic", () => {
    const spec: ReactiveSpec = {
      type: "reactive",
      state: { a: 1, b: 2 },
      reactions: [{ on: "swap", do: [{ set: "a", to: "b" }, { set: "b", to: "a" }] }],
      display: [],
    };
    const vm = new ReactiveVM(spec);
    const snap = vm.dispatch(ev("swap"));
    expect(snap.state).toEqual({ a: 2, b: 1 });
  });

  it("computes bindings in topological order regardless of declaration order", () => {
    const spec: ReactiveSpec = {
      type: "reactive",
      state: { n: 1 },
      bindings: { b: "a + 1", a: "n + 1" },
      display: [],
    };
    const vm = new ReactiveVM(spec);
    expect(vm.bindings).toEqual({ a: 2, b: 3 });
  });

  it("recomputes bindings after a committed reaction", () => {
    const spec: ReactiveSpec = {
      type: "reactive",
      state: { n: 0 },
      bindings: { dbl: "n * 2" },
      reactions: [{ on: "inc", do: [{ set: "n", to: "n + 1" }] }],
      display: [],
    };
    const vm = new ReactiveVM(spec);
    vm.dispatch(ev("inc"));
    expect(vm.state.n).toBe(1);
    expect(vm.bindings.dbl).toBe(2);
  });

  it("detects binding cycles at construction", () => {
    expect(() => bindingOrder({}, { a: "b", b: "a" })).toThrow(VMError);
    expect(() => bindingOrder({}, { a: "b", b: "a" })).toThrow(/Binding cycle/);
  });

  it("throws on a duplicate write within one atomic reaction", () => {
    const spec: ReactiveSpec = {
      type: "reactive",
      state: { n: 0 },
      reactions: [{ on: "x", do: [{ set: "n", to: "1" }, { set: "n", to: "2" }] }],
      display: [],
    };
    const vm = new ReactiveVM(spec);
    expect(() => vm.dispatch(ev("x"))).toThrow(/writes "n" twice/);
  });

  it("honours eval timing: submit-only does not evaluate on plain events", () => {
    const spec: ReactiveSpec = {
      type: "reactive",
      state: { n: 0 },
      reactions: [{ on: "inc", do: [{ set: "n", to: "1" }] }],
      evaluator: { ok: "n == 1", msgOk: "done" },
      evaluatePolicy: { onEvent: false, onSubmit: true },
      display: [],
    };
    const vm = new ReactiveVM(spec);
    let snap = vm.dispatch(ev("inc"));
    expect(snap.evalResult).toBeNull();
    expect(snap.solved).toBe(false);
    snap = vm.dispatch(ev("submit"));
    expect(snap.evalResult?.ok).toBe(true);
    expect(snap.solved).toBe(true);
  });

  it("latches solved and bumps solveTick exactly once on the correct transition", () => {
    const spec: ReactiveSpec = {
      type: "reactive",
      state: { n: 0 },
      reactions: [{ on: "inc", do: [{ set: "n", to: "n + 1" }] }],
      evaluator: { ok: "n >= 2" },
      evaluatePolicy: { onEvent: true },
      display: [],
    };
    const vm = new ReactiveVM(spec);
    expect(vm.dispatch(ev("inc")).solveTick).toBe(0);
    expect(vm.dispatch(ev("inc")).solveTick).toBe(1);
    expect(vm.dispatch(ev("inc")).solveTick).toBe(1);
  });

  it("when-gated reactions only fire when the guard is truthy", () => {
    const spec: ReactiveSpec = {
      type: "reactive",
      state: { n: 0 },
      reactions: [{ on: "tryInc", when: "n < 1", do: [{ set: "n", to: "n + 1" }] }],
      display: [],
    };
    const vm = new ReactiveVM(spec);
    expect(vm.dispatch(ev("tryInc")).state.n).toBe(1);
    expect(vm.dispatch(ev("tryInc")).state.n).toBe(1);
  });

  it("reset restores initial state and clears eval", () => {
    const spec: ReactiveSpec = {
      type: "reactive",
      state: { n: 0 },
      reactions: [{ on: "inc", do: [{ set: "n", to: "n + 1" }] }],
      evaluator: { ok: "n == 1" },
      display: [],
    };
    const vm = new ReactiveVM(spec);
    vm.dispatch(ev("inc"));
    const snap = vm.reset();
    expect(snap.state.n).toBe(0);
    expect(snap.evalResult).toBeNull();
    expect(snap.solved).toBe(false);
  });
});

describe("ReactiveVM synthetic correct/wrong events (§3.7)", () => {
  it("dispatches a synthetic `correct` event that fires its reaction on auto-solve", () => {
    const spec: ReactiveSpec = {
      type: "reactive",
      state: { n: 0, celebrated: false },
      reactions: [
        { on: "inc", do: [{ set: "n", to: "n + 1" }] },
        { on: "correct", do: [{ set: "celebrated", to: "true" }] },
      ],
      evaluator: { ok: "n >= 1" },
      evaluatePolicy: { onEvent: true },
      display: [],
    };
    const vm = new ReactiveVM(spec);
    const snap = vm.dispatch(ev("inc"));
    expect(snap.solved).toBe(true);
    expect(snap.state.celebrated).toBe(true);
  });

  it("never re-evaluates a synthetic event — a `correct` reaction cannot trigger `wrong`", () => {
    // The correct reaction zeroes n (which would make the evaluator false), but
    // synthetic events skip evaluation, so no regression/wrong fires and no loop.
    const spec: ReactiveSpec = {
      type: "reactive",
      state: { n: 0, wrongs: 0 },
      reactions: [
        { on: "inc", do: [{ set: "n", to: "5" }] },
        { on: "correct", do: [{ set: "n", to: "0" }] },
        { on: "wrong", do: [{ set: "wrongs", to: "wrongs + 1" }] },
      ],
      evaluator: { ok: "n >= 3" },
      evaluatePolicy: { onEvent: true },
      evalEventPolicy: { emitWrongOnRegression: true },
      display: [],
    };
    const vm = new ReactiveVM(spec);
    const snap = vm.dispatch(ev("inc"));
    expect(snap.solved).toBe(true);
    expect(snap.state.n).toBe(0); // the correct reaction ran
    expect(snap.state.wrongs).toBe(0); // but it did not re-evaluate into a wrong
  });

  it("dispatches a synthetic `wrong` event on a failed submit", () => {
    const spec: ReactiveSpec = {
      type: "reactive",
      state: { n: 0, tries: 0 },
      reactions: [{ on: "wrong", do: [{ set: "tries", to: "tries + 1" }] }],
      evaluator: { ok: "n == 1" },
      evaluatePolicy: { onEvent: false, onSubmit: true },
      display: [],
    };
    const vm = new ReactiveVM(spec);
    const snap = vm.dispatch(ev("submit"));
    expect(snap.evalResult?.ok).toBe(false);
    expect(snap.state.tries).toBe(1);
  });

  it("respects emitWrongOnSubmit: false", () => {
    const spec: ReactiveSpec = {
      type: "reactive",
      state: { n: 0, tries: 0 },
      reactions: [{ on: "wrong", do: [{ set: "tries", to: "tries + 1" }] }],
      evaluator: { ok: "n == 1" },
      evaluatePolicy: { onEvent: false, onSubmit: true },
      evalEventPolicy: { emitWrongOnSubmit: false },
      display: [],
    };
    const vm = new ReactiveVM(spec);
    expect(vm.dispatch(ev("submit")).state.tries).toBe(0);
  });

  it("respects emitCorrectOnAutoSolve: false (no latch, no correct event)", () => {
    const spec: ReactiveSpec = {
      type: "reactive",
      state: { n: 0, c: 0 },
      reactions: [
        { on: "inc", do: [{ set: "n", to: "n + 1" }] },
        { on: "correct", do: [{ set: "c", to: "c + 1" }] },
      ],
      evaluator: { ok: "n >= 1" },
      evaluatePolicy: { onEvent: true },
      evalEventPolicy: { emitCorrectOnAutoSolve: false },
      display: [],
    };
    const vm = new ReactiveVM(spec);
    const snap = vm.dispatch(ev("inc"));
    expect(snap.solved).toBe(false);
    expect(snap.state.c).toBe(0);
  });

  it("emits `wrong` on a regression when emitWrongOnRegression is set", () => {
    const spec: ReactiveSpec = {
      type: "reactive",
      state: { n: 0, regressions: 0 },
      reactions: [
        { on: "set", do: [{ set: "n", to: "event.v" }] },
        { on: "wrong", do: [{ set: "regressions", to: "regressions + 1" }] },
      ],
      evaluator: { ok: "n >= 1" },
      evaluatePolicy: { onEvent: true },
      evalEventPolicy: { emitWrongOnRegression: true },
      display: [],
    };
    const vm = new ReactiveVM(spec);
    expect(vm.dispatch(ev("set", { v: 2 })).state.regressions).toBe(0); // solve
    expect(vm.dispatch(ev("set", { v: 0 })).state.regressions).toBe(1); // regress
  });
});
