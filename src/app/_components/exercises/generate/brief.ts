/* ═══════════════════════════════════════════════════════════════════
   The exercise brief — the contract between intent and construction.

   A smart lesson model emits a brief *inline while writing the lesson*: it
   carries the taste-heavy parts (what misconception to target, the goal,
   the transfer question) but NOT the mechanical spec. A constructor (a
   weaker, cheaper model, or a template) turns the brief into a validated
   ReactiveSpec via the markup frontend + validator + repair loop. Authoring
   the brief in the lesson's flow is what keeps the exercise naturally
   integrated — the constructor never has to re-derive the lesson's context.
   ═══════════════════════════════════════════════════════════════════ */
import { z } from "zod";

export const ARCHETYPES = ["arena", "plot", "graph", "auto"] as const;
export type Archetype = (typeof ARCHETYPES)[number];

export const STEP_ROLES = ["prime", "predict", "reveal", "name", "apply", "stretch", "reflect"] as const;

export const exerciseBriefSchema = z.object({
  /** The idea this exercise teaches, in one phrase. */
  concept: z.string().min(1),
  /** The wrong mental model to expose — the thing the learner likely believes. */
  misconception: z.string().optional(),
  /** Which stage visual fits the shape of the model. "auto" ⇒ constructor picks. */
  archetype: z.enum(ARCHETYPES).default("auto"),
  /** Prose sketch of the state model the stage reads (lists, counters). */
  dataModel: z.string().min(1),
  /** What the learner edits/runs, if code is involved — names the harness need. */
  codeIntent: z.string().optional(),
  /** What "solved" means — the constructor turns this into evaluator.ok. */
  goal: z.string().min(1),
  /** The question that transfers the idea past this instance. Taste; the smart
      model writes it, the constructor copies it verbatim. */
  criticalThinking: z.string().min(1),
  accent: z.enum(["azure", "violet", "amber", "emerald"]).optional(),
  /** Where the exercise sits in the lesson arc. */
  role: z.enum(STEP_ROLES).optional(),
  /** lesson-state → exercise-state seeding intent (expr strings). */
  reads: z.record(z.string()).optional(),
  /** exercise-state → lesson-state projection intent (expr strings). */
  writes: z.record(z.string()).optional(),
});

export type ExerciseBrief = z.infer<typeof exerciseBriefSchema>;

/** A lesson draft: the smart model's output for the full pipeline. Each step
    pairs a role with an inline brief; the constructor realises each brief. */
export const lessonDraftSchema = z.object({
  title: z.string().min(1),
  summary: z.string().optional(),
  steps: z
    .array(
      z.object({
        role: z.enum(STEP_ROLES),
        brief: exerciseBriefSchema,
      }),
    )
    .min(1),
});

export type LessonDraft = z.infer<typeof lessonDraftSchema>;
