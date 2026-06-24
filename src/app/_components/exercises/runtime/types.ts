/* ═══════════════════════════════════════════════════════════════════
   EXIGO AAP — Reactive VM types.
   The single source of truth for the runtime contract described in the
   v3 architecture. A spec is pure data; the VM executes it
   deterministically. No lambdas live in a spec — only expression
   strings evaluated by the DSL (see ./expr.ts).
   ═══════════════════════════════════════════════════════════════════ */

/** A runtime value. Grids are `number[][]`; objects are plain records. */
export type Value =
  | number
  | string
  | boolean
  | null
  | Value[]
  | { [k: string]: Value };

export type Accent = "amber" | "azure" | "violet" | "emerald";
export type ShellVariant = "inset" | "framed" | "focus";

/** An expression string in the safe DSL, e.g. `"if(n == 0, 0, n - 1)"`. */
export type Expr = string;

/** A single atomic assignment inside a reaction: `state[set] = eval(to)`. */
export interface Assignment {
  set: string;
  to: Expr;
}

/** A reaction fires on an event type; `when` gates it; `do` mutates state. */
export interface Reaction {
  on: string;
  when?: Expr;
  do: Assignment[];
  /** Opt in to a key being written across multiple reactions for one event. */
  allowSequentialWrite?: boolean;
}

/** Declarative evaluator. `ok` is a boolean expression over state/bindings. */
export interface Evaluator {
  ok: Expr;
  msgOk?: string;
  msgNo?: string;
  hint?: string;
  /** Optional 0..1 "how close" expression that drives the proximity rail. */
  proximity?: Expr;
}

export interface TickSpec {
  enabled: boolean;
  fps?: 1 | 2 | 5 | 10 | 15 | 30;
  pauseWhenHidden?: boolean;
}

export interface EvaluatePolicy {
  onMount?: boolean;
  onEvent?: boolean;
  onTick?: boolean;
  onSubmit?: boolean;
}

export interface EvalEventPolicy {
  emitCorrectOnAutoSolve?: boolean;
  emitWrongOnSubmit?: boolean;
  emitWrongOnRegression?: boolean;
}

/* ── Display layer ──────────────────────────────────────────────── */

export type ToneToken = Accent | "muted" | "ghost" | "ok" | "no";

export interface PointExpr {
  x: Expr;
  y: Expr;
}

export type ShapeSpec =
  | { type: "circle"; cx: Expr; cy: Expr; r: Expr; tone?: ToneToken }
  | { type: "rect"; x: Expr; y: Expr; w: Expr; h: Expr; tone?: ToneToken }
  | { type: "line"; x1: Expr; y1: Expr; x2: Expr; y2: Expr; tone?: ToneToken }
  | { type: "arrow"; from: PointExpr; to: PointExpr; tone?: ToneToken }
  | { type: "label"; at: PointExpr; text: string; tone?: ToneToken }
  | { type: "path"; points: Expr; tone?: ToneToken; style?: "solid" | "dashed" };

export interface TokenizedSceneSpec {
  coordinateSystem?: "unit" | "cartesian" | "grid";
  width?: number;
  height?: number;
  shapes: ShapeSpec[];
}

export interface ControlSpec {
  type: "button" | "slider" | "toggle";
  label?: string;
  /** Event type dispatched on interaction. */
  event: string;
  /** Static payload merged into the dispatched event. */
  payload?: Record<string, Expr>;
  /** slider only. `min`/`max` accept an expression so bounds can track the
      data they scrub (e.g. `max: "len(steps) - 1"`) — a static number that
      drifts from the model is a whole class of authoring bugs. */
  id?: string;
  min?: number | Expr;
  max?: number | Expr;
  step?: number;
  /** Expr for current slider value (reads state). */
  value?: Expr;
  unit?: string;
  tone?: ToneToken;
  /** Disable when this expr is truthy. */
  disabledWhen?: Expr;
}

export type CodeEditMode =
  | "locked"
  | "holes"
  | "singleRegionFreeText"
  | "multiRegionFreeText";

export type CodeRunMode = "predictThenRun" | "step" | "live" | "manualRun";

export interface CodeChoice {
  id: string;
  text: string;
  label?: string;
}

export type CodeRegion =
  | { kind: "locked"; id: string; text: string }
  | { kind: "editableText"; id: string; initial: string; maxChars: number }
  | { kind: "choiceHole"; id: string; choices: CodeChoice[] }
  | {
      kind: "blankHole";
      id: string;
      placeholder: string;
      allowedPattern?: string;
      maxChars: number;
    };

export interface HarnessRef {
  id: string;
}

export interface TraceViewSpec {
  /** State key the assembled trace is written to, e.g. "trace". */
  bind?: string;
  show?: "stack" | "log" | "both";
}

/** How the observation player replays a stream (v4). */
export interface PlaybackSpec {
  mode: "instant" | "auto" | "step";
  /** auto only — observations advanced per second. */
  fps?: number;
}

/* ── Semantic archetypes (§"models, not pixels") ──────────────────────
   These are the RICH visual primitives. The author declares a data MODEL
   and bindings; the primitive owns ALL layout, scaling, packing, routing,
   color and animation. The author never writes a coordinate. The same
   primitive serves any domain — a C++ pmr arena, a CPU cache, a memory
   pool, a parking lot — because it reasons about regions and blocks, not
   bytes. The model is meant to be folded from harness observations. */

/** One bounded (or unbounded) region of an `arena`: a buffer, a heap, a
    pool, a cache line. `capacity` omitted ⇒ unbounded (e.g. the system heap). */
export interface ArenaRegion {
  id: string;
  label?: string;
  /** Capacity in the same unit as a block's `size`. Omit for unbounded. */
  capacity?: number;
  /** Unit suffix shown in the used/cap readout, e.g. "B", "slots". */
  unit?: string;
  tone?: ToneToken;
}

/** When a region fills, allocations escape to another region — the runtime
    draws an animated arrow from `from` → `to` whenever `to` holds blocks. */
export interface ArenaOverflow {
  from: string;
  to: string;
  label?: string;
}

/** A series drawn by a `plot`. `points` evaluates to `[[x, y], …]`. */
export interface PlotSeries {
  id: string;
  points: Expr;
  style?: "scatter" | "line" | "bar" | "area";
  tone?: ToneToken;
  label?: string;
}

export interface PlotAxis {
  label?: string;
  min?: number;
  max?: number;
  /** Auto-fit the axis to the data when min/max are omitted. */
  unit?: string;
}

/** A moving highlighted point (the "cursor"): synced readout + crosshair. */
export interface PlotCursor {
  x: Expr;
  y: Expr;
  label?: string;
  tone?: ToneToken;
}

/** A node in a `graph`. Position is computed by the runtime layout — never
    by the author. `group`/`rank` steer layered/tree placement only. */
export interface GraphNode {
  id: string;
  label?: string;
  tone?: ToneToken;
  group?: string;
}
export interface GraphEdge {
  from: string;
  to: string;
  label?: string;
  tone?: ToneToken;
  /** "pointer" draws a filled arrowhead; "link" a plain line. */
  kind?: "pointer" | "link";
}
export type GraphLayout = "tree" | "layered" | "stack" | "row" | "ring";

type DisplayLayerBase =
  | { type: "text"; value: Expr  ; tone?: ToneToken }
  | { type: "richText"; value: Expr   }
  | { type: "numberLine"; value: Expr; target?: Expr; min?: number; max?: number }
  | { type: "stateBadge"; value: Expr; label?: string; tone?: ToneToken }
  | { type: "cards"; items: Expr }
  | { type: "tape"; cells: Expr; head: Expr }
  | { type: "sequence"; items: Expr; cursor?: Expr; label?: string; orientation?: "row" | "stack" }
  | { type: "observationPlayer"; source?: Expr; version?: Expr; playback?: PlaybackSpec; label?: string }
  | { type: "diagramScene"; scene: TokenizedSceneSpec }
  | {
      type: "arena";
      label?: string;
      regions: ArenaRegion[];
      /** Expr → `[{ id, region, size?, label?, tone? }, …]`. */
      blocks: Expr;
      overflow?: ArenaOverflow;
    }
  | {
      type: "plot";
      label?: string;
      x?: PlotAxis;
      y?: PlotAxis;
      series: PlotSeries[];
      target?: PlotSeries;
      cursor?: PlotCursor;
    }
  | {
      type: "graph";
      label?: string;
      /** Expr → `[{ id, label?, tone?, group? }, …]`. */
      nodes: Expr;
      /** Expr → `[{ from, to, label?, kind? }, …]`. */
      edges?: Expr;
      layout?: GraphLayout;
      directed?: boolean;
    }
  | {
      type: "codeProbe";
      language: string;
      source: CodeRegion[];
      harness: HarnessRef;
      editMode: CodeEditMode;
      runMode?: CodeRunMode;
      traceView?: TraceViewSpec;
      /** Event dispatched after a run; payload carries { ok, log, trace }. */
      event?: string;
    }
  | { type: "controls"; controls: ControlSpec[] };

/** Every layer may carry `showWhen`: an expression over the display env —
    the layer renders only while it's truthy (e.g. `"eval.ok"` reveals the
    critical-thinking prompt after the exercise is solved). */
export type DisplayLayer = DisplayLayerBase & { showWhen?: Expr };

/* ── Structured authoring surface (v5) ──────────────────────────────
   The generate→validate→repair loop authors THESE fields, never a raw
   display[]. `compileDisplay` lowers them into layers in a canonical
   order; the validator hard-gates a spec whose stage isn't one rich
   visual. Raw `display` remains as the compiled/internal form. */

/** What may stand on the stage — the one rich visual at the heart of an
    exercise. Text layers are not stageable by construction. */
export type StageLayer = Extract<
  DisplayLayer,
  { type: "arena" | "plot" | "graph" | "diagramScene" | "tape" | "sequence" | "numberLine" }
>;

/** Quiet text companions; the spec may carry at most two. */
export type ReadoutLayer = Extract<DisplayLayer, { type: "stateBadge" | "text" | "richText" }>;

export interface ReactiveSpec {
  type: "reactive";
  prompt?: string;
  hook?: string;
  kind?: string;
  accent?: Accent;
  variant?: ShellVariant;
  streak?: boolean;

  state: Record<string, Value>;
  bindings?: Record<string, Expr>;
  reactions?: Reaction[];
  tick?: TickSpec;
  evaluator?: Evaluator;
  evaluatePolicy?: EvaluatePolicy;
  evalEventPolicy?: EvalEventPolicy;

  /* structured surface (preferred): */
  /** The one rich visual. Required for authored exercises. */
  stage?: StageLayer;
  /** ≤ 2 quiet text layers riding along with the stage. */
  readouts?: ReadoutLayer[];
  /** A question that pushes past the mechanics; revealed when solved. */
  criticalThinking?: string;
  code?: Extract<DisplayLayer, { type: "codeProbe" }>;
  controls?: Extract<DisplayLayer, { type: "controls" }>;
  player?: Extract<DisplayLayer, { type: "observationPlayer" }>;

  /** Compiled/legacy form. Authors use the structured fields above. */
  display?: DisplayLayer[];
}

/* ── Runtime artifacts ──────────────────────────────────────────── */

export interface EvalResult {
  ok: boolean;
  msg?: string;
  hint?: string;
  proximity?: number;
}

export interface RuntimeEvent {
  type: string;
  payload: Record<string, Value>;
  timestamp: number;
}

/** Snapshot the React host renders from. */
export interface VMSnapshot {
  state: Record<string, Value>;
  bindings: Record<string, Value>;
  evalResult: EvalResult | null;
  solved: boolean;
  /** Increments whenever an auto-solve fires, to trigger celebration. */
  solveTick: number;
}
