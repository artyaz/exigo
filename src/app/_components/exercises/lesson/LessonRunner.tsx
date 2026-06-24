"use client";
/* LessonRunner — walks the Predict → Observe → Explain → Apply pattern,
   threading a shared lessonState between steps via reads/writes
   expression mappings. Each step is a ReactiveExercise. */
import React from "react";
import type { Lesson, LessonStep } from "./types";
import type { ReactiveSpec, Value, VMSnapshot } from "../runtime/types";
import { run } from "../runtime/expr";
import { ReactiveExercise } from "../ReactiveExercise";

const ROLE_LABEL: Record<string, string> = {
  prime: "Prime",
  predict: "Predict",
  reveal: "Observe",
  name: "Name it",
  apply: "Apply",
  stretch: "Stretch",
  reflect: "Reflect",
};

function seedExercise(step: LessonStep, lessonState: Record<string, Value>): ReactiveSpec {
  if (!step.reads) return step.exercise;
  const env = { ...lessonState, lessonState };
  const state = { ...step.exercise.state };
  for (const [key, expr] of Object.entries(step.reads)) {
    if (key in state) {
      try {
        state[key] = run(expr, env);
      } catch {
        /* leave default on bad read */
      }
    }
  }
  return { ...step.exercise, state };
}

function commitWrites(
  step: LessonStep,
  snap: VMSnapshot,
  meta: { duration: number; attempts: number },
  lessonState: Record<string, Value>,
): Record<string, Value> {
  if (!step.writes) return lessonState;
  const env: Record<string, Value> = {
    ...snap.state,
    ...snap.bindings,
    state: snap.state,
    bindings: snap.bindings,
    eval: { ok: snap.evalResult?.ok ?? false, proximity: snap.evalResult?.proximity ?? 0 },
    duration: meta.duration,
    attempts: meta.attempts,
  };
  const next = { ...lessonState };
  for (const [key, expr] of Object.entries(step.writes)) {
    try {
      next[key] = run(expr, env);
    } catch {
      /* skip bad write */
    }
  }
  return next;
}

export function LessonRunner({ lesson }: { lesson: Lesson }): React.JSX.Element {
  const [index, setIndex] = React.useState(0);
  const [lessonState, setLessonState] = React.useState<Record<string, Value>>(lesson.lessonState ?? {});
  const snapRef = React.useRef<VMSnapshot | null>(null);
  const startedAt = React.useRef(Date.now());

  const step = lesson.steps[index];
  const seeded = React.useMemo(() => (step ? seedExercise(step, lessonState) : null), [step, lessonState]);

  if (!step || !seeded) {
    return (
      <div className="exg-ex exg-ex--inset" style={{ padding: 24 }}>
        <div className="exg-ex__prompt">Lesson complete.</div>
        <pre className="exg-cp__log">{JSON.stringify(lessonState, null, 2)}</pre>
      </div>
    );
  }

  const last = index === lesson.steps.length - 1;
  const onNext = (): void => {
    if (snapRef.current) {
      const duration = Date.now() - startedAt.current;
      setLessonState((ls) => commitWrites(step, snapRef.current!, { duration, attempts: 1 }, ls));
    }
    startedAt.current = Date.now();
    setIndex((i) => Math.min(i + 1, lesson.steps.length));
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
        {lesson.steps.map((s, i) => (
          <span
            key={s.id}
            title={ROLE_LABEL[s.role] ?? s.role}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              background: i <= index ? "var(--emerald-400)" : "var(--border)",
              transition: "background 240ms ease",
            }}
          />
        ))}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--white-30)" }}>
        Step {index + 1}/{lesson.steps.length} · {ROLE_LABEL[step.role] ?? step.role}
      </div>

      <ReactiveExercise key={step.id} spec={seeded} onSnapshot={(s) => (snapRef.current = s)} />

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="exg-ex__btn exg-ex__btn--check" type="button" onClick={onNext}>
          {last ? "Finish" : "Next"}
        </button>
      </div>
    </div>
  );
}
