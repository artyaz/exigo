/* The exercise generation pipeline: brief (intent) → constructor (markup →
   validated spec, with repair) and the full topic → lesson → exercises path. */
export {
  exerciseBriefSchema,
  lessonDraftSchema,
  ARCHETYPES,
  STEP_ROLES,
  type ExerciseBrief,
  type LessonDraft,
  type Archetype,
} from "./brief";
export {
  describeVocabulary,
  buildConstructorSystem,
  buildConstructorUser,
  buildRepairUser,
  buildLessonSystem,
  buildLessonUser,
} from "./prompts";
export {
  constructExercise,
  evaluateMarkup,
  extractMarkup,
  type ConstructionResult,
  type ConstructionAttempt,
} from "./constructor";
export { draftLesson, constructLessonExercises, type LessonDraftResult, type ConstructedStep } from "./lesson";
export { loadAuthoringGuide } from "./guide";
