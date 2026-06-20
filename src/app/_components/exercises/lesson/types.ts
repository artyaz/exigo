/* ═══════════════════════════════════════════════════════════════════
   EXIGO AAP — Exercise → lesson state bridge (§4).
   Steps don't name keys to copy; they declare expression MAPPINGS:
   `reads` seeds exercise state from lesson state; `writes` projects the
   final exercise state/bindings/eval back into lesson state. Writes
   commit atomically at the step boundary (or a configured checkpoint).
   ═══════════════════════════════════════════════════════════════════ */
import type { Expr, ReactiveSpec, Value } from "../runtime/types";

export type StepRole = "prime" | "predict" | "reveal" | "name" | "apply" | "stretch" | "reflect";

export type LessonWritePolicy =
  | { when: "complete" }
  | { when: "submit" }
  | { when: "event"; event: string }
  | { when: "checkpoint"; id: string };

export interface LessonStep {
  id: string;
  role: StepRole;
  exercise: ReactiveSpec;
  /** lesson state → exercise state key seeding. Expr over lessonState. */
  reads?: Record<string, Expr>;
  /** lessonState key → expr over final exercise state/bindings/eval/meta. */
  writes?: Record<string, Expr>;
  writePolicy?: LessonWritePolicy;
}

export interface Lesson {
  id: string;
  title: string;
  /** Initial shared lesson state. */
  lessonState?: Record<string, Value>;
  steps: LessonStep[];
}
