/* ═══════════════════════════════════════════════════════════════════
   EXIGO AAP — Harness contracts.
   A harness turns learner code into a Trace. Real-execution harnesses
   actually run code; curated-trace harnesses encode a tested scenario
   family (and MUST ship ground-truth oracle tests — §2.1). The edit
   affordance a codeProbe may use is constrained by harness kind (§2.2).
   ═══════════════════════════════════════════════════════════════════ */
import type { CodeEditMode, Value } from "../runtime/types";

export type HarnessKind = "real-execution" | "curated-trace" | "static-analyzer" | "module";

/** Which codeProbe editModes each harness kind may legally pair with (§2.2). */
export const HARNESS_EDIT_COMPAT: Record<HarnessKind, CodeEditMode[]> = {
  "real-execution": ["singleRegionFreeText", "multiRegionFreeText", "holes", "locked"],
  "curated-trace": ["holes", "locked"],
  "static-analyzer": ["holes", "singleRegionFreeText", "locked"],
  module: ["locked", "holes", "singleRegionFreeText", "multiRegionFreeText"],
};

/** A single revealed row in a trace (stack frame, value, or log line). */
export interface TraceStep {
  label?: string;
  text: string;
  note?: string;
  /** Mark the terminal "result" row. */
  out?: boolean;
}

export interface RunResult {
  ok: boolean;
  log: string[];
  trace: TraceStep[];
  error: string | null;
  /** Raw values surfaced via `result(label, value)`, keyed by label. This is
      the *typed* channel a codeProbe forwards into state as `event.out.<label>`
      — unlike `trace[i].text`, which is stringified for display. */
  out?: Record<string, Value>;
}

/** Common surface every harness exposes to a codeProbe. */
export interface Harness {
  id: string;
  kind: HarnessKind;
  languages: string[];
  /** Run assembled source (locked + filled regions) → a trace. */
  run(source: string): RunResult;
}

/* ── Observation contract (v4) ──────────────────────────────────────
   The seam the whole v4 pipeline hangs off. A harness no longer hands
   the UI a pre-shaped trace; it emits a flat, ordered stream of typed
   *observations* of what the program did (a frame was entered, a value
   was written, a reference formed…). Reactions fold these into visual
   state; the evaluator asserts patterns over them with the obs helpers.
   The viz layer never sees domain types — only structural data. */

/** One observation. `kind` selects the schema; the rest are typed fields.
    Every field is a plain `Value`, so an Observation IS a dispatchable
    event payload — the player forwards it verbatim as `obs:<kind>`. */
export interface Observation {
  kind: string;
  [field: string]: Value;
}

/** The declared type of a single observation field. `id` is a string used
    as a stable identity (frame id, cell id) — distinct from free `string`
    so the validator/viz can treat it as a key. */
export type ObsFieldType = "number" | "string" | "boolean" | "id";

/** Schema for one observation kind: its fields and a human doc line. */
export interface ObservationKindSchema {
  fields: Record<string, ObsFieldType>;
  doc: string;
}

/** The full typed API a harness emits — the contract the author programs
    against and the validator checks every `obs:<kind>` field read against. */
export type ObservationSchema = Record<string, ObservationKindSchema>;

/** An IDE autocomplete symbol surfaced by the harness (the emit probes,
    plus any domain builtins the learner may call). */
export interface SymbolDoc {
  name: string;
  signature?: string;
  doc?: string;
  /** Text to insert on accept; defaults to `name`. */
  insert?: string;
}

/** Result of an observation run — the async, sandboxed counterpart to
    RunResult. `observations` is the ordered stream; `log` is console output. */
export interface ObservationRun {
  ok: boolean;
  error: string | null;
  observations: Observation[];
  log: string[];
}

/** A harness that emits observations. Implements the legacy `run` (for the
    trace view / back-compat) AND the async observation channel. */
export interface ObservationHarness extends Harness {
  /** The typed observation API this harness can emit. */
  observationSchema: ObservationSchema;
  /** Autocomplete symbols for the IDE editor. */
  symbols: SymbolDoc[];
  /** Run assembled source off the main thread → an observation stream. */
  runObservations(source: string): Promise<ObservationRun>;
}

/** Narrow a Harness to the observation channel. */
export function isObservationHarness(h: Harness | undefined): h is ObservationHarness {
  return (
    !!h &&
    typeof (h as ObservationHarness).runObservations === "function" &&
    typeof (h as ObservationHarness).observationSchema === "object"
  );
}

/* ── Curated-trace specifics (§2.1) ─────────────────────────────── */

export type SlotValues = Record<string, Value>;

export interface ExpectedTraceProperties {
  ok?: boolean;
  contains?: string[];
  notContains?: string[];
}

export interface GroundTruthTest {
  name: string;
  slots: SlotValues;
  expected: ExpectedTraceProperties;
  oracle: "real-compiler" | "real-runtime" | "formal-fixture" | "golden-trace";
}

export interface CuratedTraceHarness extends Harness {
  kind: "curated-trace";
  domain: string;
  scenarioFamily: string;
  /** Build a trace from constrained slot values (not free text). */
  trace(input: SlotValues): RunResult;
  groundTruthTests: GroundTruthTest[];
}
