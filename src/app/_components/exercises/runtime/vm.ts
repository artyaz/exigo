/* ═══════════════════════════════════════════════════════════════════
   EXIGO AAP — Reactive VM.
   Deterministic execution of a ReactiveSpec. Two implementations of this
   contract must behave identically; the rules below mirror the v3
   runtime contract (§3): topological bindings, atomic reactions with a
   frozen per-reaction RHS snapshot, explicit eval timing, and synthetic
   correct/wrong events.
   ═══════════════════════════════════════════════════════════════════ */
import type {
  EvalResult,
  Evaluator,
  ReactiveSpec,
  RuntimeEvent,
  Value,
  VMSnapshot,
} from "./types";
import { compile, evaluate, parse, truthy, type Ast, type Env } from "./expr";

export class VMError extends Error {}

/** Topologically order binding keys so each is computed after its deps. */
export function bindingOrder(
  state: Record<string, Value>,
  bindings: Record<string, string>,
): string[] {
  const keys = Object.keys(bindings);
  const keySet = new Set(keys);
  const deps: Record<string, string[]> = {};
  for (const k of keys) {
    const refs = compile(bindings[k]!).refs;
    deps[k] = [...refs].filter((r) => keySet.has(r) && r !== k);
  }
  const order: string[] = [];
  const state_ = new Map<string, 0 | 1 | 2>(); // 0 unseen, 1 visiting, 2 done
  const visit = (k: string, stack: string[]): void => {
    const s = state_.get(k) ?? 0;
    if (s === 2) return;
    if (s === 1) throw new VMError(`Binding cycle: ${[...stack, k].join(" → ")}`);
    state_.set(k, 1);
    for (const d of deps[k]!) visit(d, [...stack, k]);
    state_.set(k, 2);
    order.push(k);
  };
  for (const k of keys) visit(k, []);
  return order;
}

function makeEnv(
  state: Record<string, Value>,
  bindings: Record<string, Value>,
  event?: Record<string, Value>,
): Env {
  // bare precedence: state < bindings < event payload (so event aliases win)
  const env: Env = { ...state, ...bindings };
  if (event) Object.assign(env, event);
  env.state = state;
  env.bindings = bindings;
  if (event) env.event = event;
  return env;
}

/** A reaction with its `when`/`to` expressions pre-parsed once at construction. */
interface CompiledReaction {
  on: string;
  when: Ast | null;
  allowSequentialWrite: boolean;
  dos: { set: string; to: Ast }[];
}

export class ReactiveVM {
  readonly spec: ReactiveSpec;
  private order: string[];
  private bindingAst: Record<string, Ast>;
  private reactionAst: CompiledReaction[];
  private evaluatorAst: { ok: Ast; proximity?: Ast } | null;
  /** ok value from the previous evaluation — the basis for correct/wrong transitions. */
  private lastEvalOk = false;

  state: Record<string, Value>;
  bindings: Record<string, Value>;
  evalResult: EvalResult | null = null;
  solved = false;
  solveTick = 0;

  constructor(spec: ReactiveSpec) {
    this.spec = spec;
    this.order = bindingOrder(spec.state, spec.bindings ?? {});
    this.bindingAst = {};
    for (const [k, src] of Object.entries(spec.bindings ?? {})) this.bindingAst[k] = parse(src);
    this.reactionAst = (spec.reactions ?? []).map((r) => ({
      on: r.on,
      when: r.when ? parse(r.when) : null,
      allowSequentialWrite: r.allowSequentialWrite === true,
      dos: (r.do ?? []).map((a) => ({ set: a.set, to: parse(a.to) })),
    }));
    this.evaluatorAst = spec.evaluator
      ? {
          ok: parse(spec.evaluator.ok),
          proximity: spec.evaluator.proximity ? parse(spec.evaluator.proximity) : undefined,
        }
      : null;
    this.state = clone(spec.state);
    this.bindings = this.computeBindings(this.state);
    if (spec.evaluatePolicy?.onMount) this.runEvaluator();
  }

  private computeBindings(state: Record<string, Value>): Record<string, Value> {
    const out: Record<string, Value> = {};
    for (const k of this.order) {
      const env = makeEnv(state, out);
      out[k] = evaluate(this.bindingAst[k]!, env);
    }
    return out;
  }

  private runEvaluator(): EvalResult | null {
    if (!this.evaluatorAst || !this.spec.evaluator) return this.evalResult;
    const env = makeEnv(this.state, this.bindings);
    const ev: Evaluator = this.spec.evaluator;
    const ok = truthy(evaluate(this.evaluatorAst.ok, env));
    let proximity: number | undefined;
    if (this.evaluatorAst.proximity) {
      const p = evaluate(this.evaluatorAst.proximity, env);
      if (typeof p === "number") proximity = Math.max(0, Math.min(1, p));
    }
    const result: EvalResult = {
      ok,
      msg: ok ? ev.msgOk : ev.msgNo,
      hint: ok ? undefined : ev.hint,
      proximity: proximity ?? (ok ? 1 : undefined),
    };
    this.evalResult = result;
    return result;
  }

  /** Dispatch an event through the full §3.4 pipeline. Returns a snapshot. */
  dispatch(event: RuntimeEvent): VMSnapshot {
    return this.dispatchInternal(event, 0);
  }

  private dispatchInternal(event: RuntimeEvent, depth: number): VMSnapshot {
    for (let i = 0; i < this.reactionAst.length; i++) {
      const reaction = this.reactionAst[i]!;
      if (reaction.on !== event.type) continue;
      const whenEnv = makeEnv(this.state, this.bindings, event.payload);
      if (reaction.when && !truthy(evaluate(reaction.when, whenEnv))) continue;

      // frozen per-reaction snapshot — all RHS read the same pre-reaction values
      const frozen = makeEnv(this.state, this.bindings, event.payload);
      const writes: Record<string, Value> = {};
      for (const a of reaction.dos) {
        if (a.set in writes) throw new VMError(`Reaction writes "${a.set}" twice in one atomic reaction.`);
        if (!(a.set in this.state)) throw new VMError(`Reaction assigns unknown state key "${a.set}".`);
        writes[a.set] = evaluate(a.to, frozen);
      }
      // atomic commit + binding recompute
      this.state = { ...this.state, ...writes };
      this.bindings = this.computeBindings(this.state);
    }

    // Synthetic correct/wrong events (depth > 0) never re-evaluate — they are a
    // *consequence* of an evaluation, so re-running it would recurse (§3.7).
    if (depth === 0) {
      const policy = this.spec.evaluatePolicy ?? { onEvent: true, onSubmit: true };
      const shouldEval =
        event.type === "submit"
          ? policy.onSubmit !== false
          : event.type === "tick"
            ? policy.onTick === true
            : policy.onEvent !== false;

      if (shouldEval) {
        const prevOk = this.lastEvalOk;
        this.runEvaluator();
        const ok = this.evalResult?.ok ?? false;
        this.lastEvalOk = ok;
        this.emitTransitions(prevOk, ok, event.type, event.timestamp);
      }
    }
    return this.snapshot();
  }

  /** §3.7 — latch `solved` and emit synthetic correct/wrong by transition.
      The emitted events run their own reactions but are barred from
      re-triggering evaluation by the depth guard in `dispatchInternal`. */
  private emitTransitions(prevOk: boolean, ok: boolean, eventType: string, ts: number): void {
    const policy = this.spec.evalEventPolicy ?? {};
    let emittedWrong = false;

    if (!prevOk && ok && policy.emitCorrectOnAutoSolve !== false) {
      this.solved = true;
      this.solveTick++;
      this.dispatchInternal({ type: "correct", payload: {}, timestamp: ts }, 1);
    }
    if (prevOk && !ok && policy.emitWrongOnRegression === true) {
      this.dispatchInternal({ type: "wrong", payload: {}, timestamp: ts }, 1);
      emittedWrong = true;
    }
    if (eventType === "submit" && !ok && policy.emitWrongOnSubmit !== false && !emittedWrong) {
      this.dispatchInternal({ type: "wrong", payload: {}, timestamp: ts }, 1);
    }
  }

  reset(): VMSnapshot {
    this.state = clone(this.spec.state);
    this.bindings = this.computeBindings(this.state);
    this.evalResult = null;
    this.solved = false;
    this.lastEvalOk = false;
    // solveTick stays monotonic: the host compares it against a persistent ref
    // to fire celebration, so zeroing it here would break post-reset re-solves.
    if (this.spec.evaluatePolicy?.onMount) this.runEvaluator();
    return this.snapshot();
  }

  snapshot(): VMSnapshot {
    return {
      state: this.state,
      bindings: this.bindings,
      evalResult: this.evalResult,
      solved: this.solved,
      solveTick: this.solveTick,
    };
  }

  /** Env for display layers: state + bindings + eval, namespaced + bare. */
  displayEnv(): Env {
    const env = makeEnv(this.state, this.bindings);
    env.eval = this.evalResult
      ? { ok: this.evalResult.ok, proximity: this.evalResult.proximity ?? 0 }
      : { ok: false, proximity: 0 };
    return env;
  }
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
