/* Atlas — a parallel-generated tree of knowledge. One agent picks the sciences;
   the pyramid widens from there (subtopics → lessons → exercises), each level
   fanned out concurrently with retries, streamed to the explorer as it lands. */

export interface Science {
  id: string;
  name: string;
}
export interface Subtopic {
  id: string;
  scienceId: string;
  title: string;
  blurb?: string;
}
/** A placeholder the lesson author left: what an inline exercise here should teach. */
export interface ExerciseSpec {
  id: string;
  subtopicId: string;
  description: string;
}
export interface BuiltExercise {
  id: string;
  /** The mechanic chosen (randomly) from the 5 brainstormed. */
  chosen?: string;
  /** Self-contained HTML body to render in the embed sandbox. */
  html: string;
  error?: string;
}
export interface Lesson {
  subtopicId: string;
  title: string;
  /** Markdown lesson body, exercises slotted between sections by order. */
  content: string;
  exercises: ExerciseSpec[];
}

/** Counts + execution knobs for one Atlas run. */
export interface AtlasConfig {
  sciences: number;
  subtopicsPerScience: number;
  /** Bound on the lesson author's exercise count (it picks within this). */
  exercisesPerLesson: { min: number; max: number };
  brainstorm: number;
  /** Max LLM calls in flight across the whole pyramid. */
  concurrency: number;
  retries: number;
}

export const ATLAS_DEFAULT: AtlasConfig = {
  sciences: 10,
  subtopicsPerScience: 3,
  exercisesPerLesson: { min: 2, max: 3 },
  brainstorm: 5,
  concurrency: 6,
  retries: 3,
};

/** A tiny run for wiring/cost checks: 2 → 1 → 1 ≈ 2 exercises total. */
export const ATLAS_QUICK: AtlasConfig = {
  sciences: 2,
  subtopicsPerScience: 1,
  exercisesPerLesson: { min: 1, max: 1 },
  brainstorm: 3,
  concurrency: 4,
  retries: 2,
};

/** NDJSON events streamed from the generator to the explorer, in widen order. */
export type AtlasEvent =
  | { type: "sciences"; sciences: Science[] }
  | { type: "subtopics"; scienceId: string; subtopics: Subtopic[] }
  | { type: "lesson"; lesson: Lesson }
  | { type: "exercise"; spec: ExerciseSpec; built: BuiltExercise }
  | { type: "error"; stage: string; id?: string; message: string }
  | { type: "done" };
