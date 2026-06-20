"use client";
/* ReactiveExercise — the React host for a ReactiveSpec. It owns the VM
   instance, drives the optional tick clock, projects the display, and
   wires the shell's feedback/celebration. The spec stays pure data. */
import React from "react";
import type { ReactiveSpec, RuntimeEvent, VMSnapshot } from "./runtime/types";
import { ReactiveVM } from "./runtime/vm";
import { ExerciseShell, CheckFooter } from "./shell/ExerciseShell";
import { ExerciseBoundary } from "./shell/ExerciseBoundary";
import { useCelebrate, bumpStreak } from "./shell/runtimeUi";
import { Display } from "./display/Display";
import { compileDisplay } from "./runtime/compile";

export function useReactiveVM(spec: ReactiveSpec): {
  vm: ReactiveVM | null;
  snapshot: VMSnapshot | null;
  error: string | null;
  dispatch: (e: RuntimeEvent) => void;
  reset: () => void;
} {
  const vmRef = React.useRef<ReactiveVM | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [snapshot, setSnapshot] = React.useState<VMSnapshot | null>(null);

  React.useEffect(() => {
    try {
      const vm = new ReactiveVM(spec);
      vmRef.current = vm;
      setError(null);
      setSnapshot(vm.snapshot());
    } catch (e) {
      vmRef.current = null;
      setError(e instanceof Error ? e.message : String(e));
      setSnapshot(null);
    }
  }, [spec]);

  const dispatch = React.useCallback((e: RuntimeEvent) => {
    if (!vmRef.current) return;
    try {
      setSnapshot(vmRef.current.dispatch(e));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const reset = React.useCallback(() => {
    if (!vmRef.current) return;
    setSnapshot(vmRef.current.reset());
  }, []);

  return { vm: vmRef.current, snapshot, error, dispatch, reset };
}

export function ReactiveExercise({
  spec,
  onSnapshot,
}: {
  spec: ReactiveSpec;
  onSnapshot?: (snap: VMSnapshot) => void;
}): React.JSX.Element {
  const { vm, snapshot, error, dispatch, reset } = useReactiveVM(spec);
  const { burstRef, fire } = useCelebrate();
  const lastSolveTick = React.useRef(0);

  React.useEffect(() => {
    if (snapshot && onSnapshot) onSnapshot(snapshot);
  }, [snapshot, onSnapshot]);

  // tick clock
  React.useEffect(() => {
    if (!spec.tick?.enabled || !vm) return;
    const fps = spec.tick.fps ?? 2;
    const dtMs = 1000 / fps;
    let last = performance.now();
    const id = window.setInterval(() => {
      if (spec.tick?.pauseWhenHidden && document.hidden) return;
      const now = performance.now();
      dispatch({ type: "tick", payload: { now, dtMs: now - last }, timestamp: now });
      last = now;
    }, dtMs);
    return () => window.clearInterval(id);
  }, [spec, vm, dispatch]);

  // celebrate on auto-solve
  React.useEffect(() => {
    if (!snapshot) return;
    if (snapshot.solveTick > lastSolveTick.current) {
      lastSolveTick.current = snapshot.solveTick;
      fire(spec.accent ?? "emerald");
      bumpStreak();
    }
  }, [snapshot, fire, spec.accent]);

  if (error) {
    return (
      <ExerciseShell kind="error" accent="violet" variant="framed" prompt={spec.prompt} streak={false}>
        <div className="exg-cp__log" style={{ color: "var(--rose-400)" }}>
          Runtime error: {error}
        </div>
      </ExerciseShell>
    );
  }
  if (!vm || !snapshot) return <div className="exg-cp__log">loading…</div>;

  const env = vm.displayEnv();
  const ev = snapshot.evalResult;
  const status = ev
    ? ev.ok
      ? { kind: "ok" as const, msg: ev.msg }
      : ev.hint || ev.msg
        ? { kind: "hint" as const, msg: ev.hint ?? ev.msg }
        : null
    : null;

  const hasEvaluator = Boolean(spec.evaluator);
  const wantsSubmit = (spec.evaluatePolicy?.onSubmit ?? true) && !(spec.evaluatePolicy?.onEvent ?? true);

  return (
    <ExerciseShell
      kind={spec.kind ?? "reactive"}
      accent={spec.accent ?? "amber"}
      variant={spec.variant ?? "inset"}
      prompt={spec.prompt}
      hook={spec.hook}
      streak={spec.streak ?? true}
      solved={snapshot.solved}
      popKey={snapshot.solveTick}
      proximity={ev?.proximity ?? null}
      burstRef={burstRef}
      footer={
        hasEvaluator ? (
          <CheckFooter
            onReset={reset}
            status={status}
            onCheck={wantsSubmit ? () => dispatch({ type: "submit", payload: {}, timestamp: Date.now() }) : null}
            checkLabel="Submit"
          />
        ) : (
          <CheckFooter onReset={reset} status={null} onCheck={null} />
        )
      }
    >
      <ExerciseBoundary resetKey={spec}>
        <Display display={compileDisplay(spec)} env={env} dispatch={dispatch} />
      </ExerciseBoundary>
    </ExerciseShell>
  );
}
