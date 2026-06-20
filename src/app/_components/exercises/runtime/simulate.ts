/* ═══════════════════════════════════════════════════════════════════
   Playability simulation — the "strong validation" half.

   Static validation proves a spec is well-formed; it can't prove the
   learner can actually WIN. This drives the real ReactiveVM over the
   finite space of learner actions (controls today; generic interactions
   next) and searches for a sequence that satisfies the evaluator. It also
   notices controls that never change anything (dead) and actions that
   throw. It only runs for code-free exercises — code produces observations
   at runtime we can't enumerate, so those keep the static checks alone.

   This is what turns "looks valid" into "is playable": an exercise whose
   goal is unreachable (e.g. a reaction on an event nothing dispatches) is
   rejected here, not shipped.
   ═══════════════════════════════════════════════════════════════════ */
import { ReactiveVM } from "./vm";
import { run } from "./expr";
import type { ReactiveSpec, RuntimeEvent, Value, ControlSpec } from "./types";

export interface PlayabilityResult {
  /** Hard failures: the exercise is provably broken / unplayable. */
  errors: string[];
  /** Soft notes: couldn't fully verify, or a control looks inert. */
  warnings: string[];
  /** Did the search reach a winning state? */
  winnable: boolean;
}

const MAX_NODES = 5000;
const MAX_DEPTH = 16;
const SLIDER_SAMPLES = 5;

type Env = Record<string, Value>;

function isSolved(spec: ReactiveSpec, state: Env, bindings: Env): boolean {
  const ok = spec.evaluator?.ok;
  if (!ok) return false;
  try {
    return Boolean(run(ok, { ...state, ...bindings }));
  } catch {
    return false;
  }
}

function evalNum(v: number | string | undefined, env: Env, fallback: number): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    try {
      const r = run(v, env);
      return typeof r === "number" ? r : fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function sliderValues(lo: number, hi: number): number[] {
  if (hi <= lo) return [lo];
  const out = new Set<number>();
  for (let i = 0; i < SLIDER_SAMPLES; i++) {
    out.add(Math.round(lo + ((hi - lo) * i) / (SLIDER_SAMPLES - 1)));
  }
  return [...out];
}

interface Action {
  control: number;
  event: RuntimeEvent;
}

/** The learner's atomic actions available in a given state, from controls. */
function actionsAt(controls: ControlSpec[], state: Env, bindings: Env): Action[] {
  const env: Env = { ...state, ...bindings };
  const out: Action[] = [];
  controls.forEach((c, ci) => {
    if (c.disabledWhen) {
      try {
        if (run(c.disabledWhen, env)) return;
      } catch {
        /* treat an erroring guard as enabled */
      }
    }
    if (c.type === "slider") {
      const lo = evalNum(c.min, env, 0);
      const hi = evalNum(c.max, env, 100);
      for (const v of sliderValues(lo, hi)) {
        out.push({ control: ci, event: { type: c.event, payload: { value: v }, timestamp: 0 } });
      }
    } else {
      const payload: Record<string, Value> = {};
      if (c.payload) {
        for (const [k, e] of Object.entries(c.payload)) {
          try {
            payload[k] = run(e, env);
          } catch {
            payload[k] = null;
          }
        }
      }
      out.push({ control: ci, event: { type: c.event, payload, timestamp: 0 } });
    }
  });
  return out;
}

/** Build a VM and replay a sequence; returns the resulting VM or throws. */
function replay(spec: ReactiveSpec, seq: RuntimeEvent[]): ReactiveVM {
  const vm = new ReactiveVM(spec);
  for (const ev of seq) vm.dispatch(ev);
  return vm;
}

export function checkPlayable(spec: ReactiveSpec): PlayabilityResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Only code-free exercises are statically simulatable.
  if (spec.code) return { errors, warnings, winnable: true };
  if (!spec.evaluator?.ok) return { errors, warnings, winnable: true }; // nothing to win

  const controls = spec.controls?.controls ?? [];

  // Already solved at the start? (degenerate but valid.)
  let startVm: ReactiveVM;
  try {
    startVm = new ReactiveVM(spec);
  } catch (e) {
    errors.push(`The exercise fails to initialise: ${e instanceof Error ? e.message : String(e)}`);
    return { errors, warnings, winnable: false };
  }
  if (isSolved(spec, startVm.state, startVm.bindings)) {
    return { errors, warnings, winnable: true };
  }

  if (controls.length === 0) {
    errors.push(
      "This exercise can't be played: the goal isn't met at the start and there are no <controls> for the learner to act with, so it can never be reached. Add a <controls> with buttons whose `event` matches the events your <on> reactions handle.",
    );
    return { errors, warnings, winnable: false };
  }

  const used = new Set<number>();
  const visited = new Set<string>();
  const queue: RuntimeEvent[][] = [[]];
  let nodes = 0;
  let truncated = false;
  let winnable = false;
  let actionError: string | null = null;

  while (queue.length) {
    if (nodes++ > MAX_NODES) {
      truncated = true;
      break;
    }
    const seq = queue.shift()!;
    let vm: ReactiveVM;
    try {
      vm = replay(spec, seq);
    } catch {
      continue; // a mid-sequence error: this branch is dead, others may win
    }
    if (isSolved(spec, vm.state, vm.bindings)) {
      winnable = true;
      break;
    }
    const key = JSON.stringify(vm.state);
    if (visited.has(key)) continue;
    visited.add(key);
    if (seq.length >= MAX_DEPTH) continue;

    for (const { control, event } of actionsAt(controls, vm.state, vm.bindings)) {
      let next: ReactiveVM;
      try {
        next = replay(spec, [...seq, event]);
      } catch (e) {
        actionError ??= e instanceof Error ? e.message : String(e);
        continue;
      }
      if (JSON.stringify(next.state) !== key) used.add(control);
      queue.push([...seq, event]);
    }
  }

  if (winnable) {
    // Even when winnable, flag controls that never did anything.
    controls.forEach((c, ci) => {
      if (!used.has(ci)) warnings.push(`control "${c.label ?? c.event}" never changes the exercise — it may be a no-op.`);
    });
  } else if (truncated) {
    warnings.push("Could not verify the exercise is winnable within the search budget; check the goal is reachable.");
  } else {
    errors.push(
      "This exercise can't be won: no sequence of the available controls reaches the goal. Make sure the controls change the state the <goal> checks (e.g. the event your <on> folds is dispatched by a control).",
    );
  }
  if (actionError) warnings.push(`An action raised an error during simulation: ${actionError}`);

  return { errors, warnings, winnable };
}
