/* ═══════════════════════════════════════════════════════════════════
   EXIGO AAP — JavaScript observation core (v4, explicit-emit probes).
   The learner's (and locked) code calls small probe functions that the
   sandbox injects: enter/exit (call frames), alloc/write (memory cells),
   ref (pointers), and a generic emit(kind, fields). Real JS runs; the
   probes push *typed observations* of what actually happened. The result
   is a flat, ordered stream the player replays and the evaluator asserts.

   This module is pure and synchronous so it is unit-testable in node. The
   browser wraps it in a terminable Worker (see jsObservationWorker.ts) for
   off-main-thread execution + a hard timeout.

   NOTE: an in-browser educational sandbox, not a security boundary. It
   defends against accidental global access, crashes, and runaway loops —
   not a determined adversary. Never run untrusted code on a privileged
   origin.
   ═══════════════════════════════════════════════════════════════════ */
import type { Observation, ObservationRun, ObservationSchema, SymbolDoc } from "./types";
import type { Value } from "../runtime/types";

const BLOCKED_GLOBALS = [
  "window",
  "document",
  "globalThis",
  "self",
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "navigator",
  "location",
  "history",
  "Function",
  "require",
  "process",
  "setTimeout",
  "setInterval",
  "setImmediate",
  "queueMicrotask",
];

/** Hard cap on emitted observations — a runaway loop calling probes would
    otherwise hang the worker until the timeout; this fails fast & cheap. */
const MAX_OBS = 2000;

class ObsLimit extends Error {}

function fmt(v: unknown): string {
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/** Coerce an arbitrary runtime value into a plain, serializable `Value`. A
    JSON round-trip drops functions/undefined and folds NaN/Infinity to null,
    so a live object reference can never leak into observation state. */
function toValue(v: unknown): Value {
  try {
    return JSON.parse(JSON.stringify(v ?? null)) as Value;
  } catch {
    return null;
  }
}

/** The typed observation API every emit-probe JS harness publishes. The
    author programs against these field names; the validator checks every
    `obs:<kind>` read against them. */
export const JS_OBSERVATION_SCHEMA: ObservationSchema = {
  enter: {
    fields: { name: "string", args: "string", depth: "number" },
    doc: "A function frame was entered. `args` is the call's argument list; `depth` is its stack depth (1 = outermost).",
  },
  exit: {
    fields: { name: "string", value: "number", depth: "number" },
    doc: "A function frame returned. `value` is the returned value; `depth` matches its `enter`.",
  },
  alloc: {
    fields: { id: "id", size: "number", region: "string", label: "string" },
    doc: "A block was allocated. `id` is its stable identity, `size` its extent, `region` the container it landed in (e.g. a buffer vs the heap), `label` a display name.",
  },
  write: {
    fields: { id: "id", value: "number" },
    doc: "A value was written into cell `id`.",
  },
  ref: {
    fields: { from: "id", to: "id" },
    doc: "A reference/pointer from cell `from` to cell `to` was formed.",
  },
  mark: {
    fields: { label: "string", value: "number" },
    doc: "A free-form checkpoint with an optional `value` — a generic step marker.",
  },
};

/** IDE autocomplete symbols for the emit probes. */
export const JS_OBSERVATION_SYMBOLS: SymbolDoc[] = [
  { name: "enter", signature: "enter(name, ...args)", doc: "Record entering a call frame.", insert: "enter(" },
  { name: "exit", signature: "exit(name, value)", doc: "Record returning from a call frame.", insert: "exit(" },
  { name: "alloc", signature: "alloc(id, size, region)", doc: "Record allocating a block of `size` in `region`.", insert: "alloc(" },
  { name: "write", signature: "write(id, value)", doc: "Record writing a value into a cell.", insert: "write(" },
  { name: "ref", signature: "ref(from, to)", doc: "Record a reference between cells.", insert: "ref(" },
  { name: "mark", signature: "mark(label, value)", doc: "Record a generic checkpoint.", insert: "mark(" },
  { name: "console", signature: "console.log(...)", doc: "Print to the run log.", insert: "console.log(" },
];

/** Run assembled source synchronously, collecting the observation stream.
    Pure: no timers, no worker, no I/O — safe to unit-test in node. */
export function runObservationsSync(source: string): ObservationRun {
  const observations: Observation[] = [];
  const log: string[] = [];
  let depth = 0;
  let seq = 0;

  const push = (o: Observation): void => {
    if (observations.length >= MAX_OBS) throw new ObsLimit(`exceeded ${MAX_OBS} observations`);
    o.t = seq++;
    observations.push(o);
  };

  const sandboxConsole = {
    log: (...a: unknown[]) => log.push(a.map(fmt).join(" ")),
    error: (...a: unknown[]) => log.push(a.map(fmt).join(" ")),
    warn: (...a: unknown[]) => log.push(a.map(fmt).join(" ")),
  };

  const enter = (name: unknown, ...args: unknown[]): void => {
    depth += 1;
    push({ kind: "enter", name: String(name), args: args.map(toValue), depth });
  };
  const exit = (name: unknown, value?: unknown): void => {
    push({ kind: "exit", name: String(name), value: toValue(value), depth });
    depth = Math.max(0, depth - 1);
  };
  const alloc = (id: unknown, size?: unknown, region?: unknown, label?: unknown): void => {
    push({
      kind: "alloc",
      id: String(id),
      size: typeof size === "number" ? size : 1,
      region: region === undefined ? "" : String(region),
      label: label === undefined ? String(id) : String(label),
    });
  };
  const write = (id: unknown, value?: unknown): void => {
    push({ kind: "write", id: String(id), value: toValue(value) });
  };
  const ref = (from: unknown, to: unknown): void => {
    push({ kind: "ref", from: String(from), to: String(to) });
  };
  const mark = (label: unknown, value?: unknown): void => {
    push({ kind: "mark", label: String(label), value: toValue(value) });
  };
  const emit = (kind: unknown, fields?: unknown): void => {
    const base: Observation = { kind: String(kind) };
    if (fields && typeof fields === "object" && !Array.isArray(fields)) {
      for (const [k, v] of Object.entries(fields as Record<string, unknown>)) {
        if (k !== "kind") base[k] = toValue(v);
      }
    }
    push(base);
  };

  const probes = { console: sandboxConsole, enter, exit, alloc, write, ref, mark, emit };
  const params = [...BLOCKED_GLOBALS, ...Object.keys(probes)];
  const args = [...BLOCKED_GLOBALS.map(() => undefined), ...Object.values(probes)];

  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    const fn = new Function(...params, `"use strict";\n${source}\n`);
    fn(...args);
    return { ok: true, error: null, observations, log };
  } catch (e) {
    if (e instanceof ObsLimit) {
      return { ok: false, error: `Run aborted: ${e.message}.`, observations, log };
    }
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    return { ok: false, error: msg, observations, log };
  }
}
