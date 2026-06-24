/* Public surface of the Exigo exercise runtime. Import from
   `~/app/_components/exercises` rather than reaching into subfolders. */
export type {
  Value,
  Accent,
  ShellVariant,
  Expr,
  Assignment,
  Reaction,
  Evaluator,
  TickSpec,
  EvaluatePolicy,
  EvalEventPolicy,
  DisplayLayer,
  StageLayer,
  ReadoutLayer,
  ShapeSpec,
  TokenizedSceneSpec,
  ArenaRegion,
  ArenaOverflow,
  PlotSeries,
  PlotAxis,
  PlotCursor,
  GraphNode,
  GraphEdge,
  GraphLayout,
  ControlSpec,
  CodeRegion,
  CodeEditMode,
  CodeRunMode,
  PlaybackSpec,
  HarnessRef,
  ReactiveSpec,
  EvalResult,
  RuntimeEvent,
  VMSnapshot,
} from "./runtime/types";

export { run, compile, parse, ExprError } from "./runtime/expr";
export { HELPERS, HELPER_NAMES, CAPS } from "./runtime/helpers";
export { ReactiveVM, VMError, bindingOrder } from "./runtime/vm";
export { validateSpec } from "./runtime/validate";
export { compileDisplay } from "./runtime/compile";
export type { ValidationError, ValidationResult } from "./runtime/validate";
export { checkPlayable } from "./runtime/simulate";
export type { PlayabilityResult } from "./runtime/simulate";

export { parseMarkup, MANIFEST as MARKUP_MANIFEST } from "./markup";
export type { ParseResult as MarkupParseResult, MarkupError, TagSpec, AttrSpec } from "./markup";

export { ReactiveExercise, useReactiveVM } from "./ReactiveExercise";
export { LessonRunner } from "./lesson/LessonRunner";
export type { Lesson, LessonStep, StepRole } from "./lesson/types";

export { getHarness, HARNESSES } from "./harness/registry";
export { isObservationHarness } from "./harness/types";
export type {
  Harness,
  RunResult,
  HarnessKind,
  Observation,
  ObservationRun,
  ObservationHarness,
  ObservationSchema,
  ObsFieldType,
  SymbolDoc,
} from "./harness/types";
