/* ═══════════════════════════════════════════════════════════════════
   EXIGO AAP — JavaScript real-execution harness.
   The first vertical slice (§8): JS actually runs, so free-text edits
   are legitimate. We capture console output and explicit `trace(label,
   value)` rows, then surface them as a stack/value trace. Dangerous
   globals are shadowed; throws are caught and reported.

   NOTE: this is an in-browser educational sandbox, not a security
   boundary. It defends against accidental global access and crashes,
   not against a determined adversary. Never run untrusted code here on
   a privileged origin.
   ═══════════════════════════════════════════════════════════════════ */
import type { Harness, RunResult, TraceStep } from "./types";
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
  "queueMicrotask",
];

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
    so a live object reference can never leak into VM state. */
function toValue(v: unknown): Value {
  try {
    return JSON.parse(JSON.stringify(v ?? null)) as Value;
  } catch {
    return null;
  }
}

export function runJs(source: string): RunResult {
  const log: string[] = [];
  const trace: TraceStep[] = [];
  const out: Record<string, Value> = {};
  const sandboxConsole = {
    log: (...args: unknown[]) => log.push(args.map(fmt).join(" ")),
    error: (...args: unknown[]) => log.push(args.map(fmt).join(" ")),
    warn: (...args: unknown[]) => log.push(args.map(fmt).join(" ")),
  };
  const traceFn = (label: unknown, value?: unknown): void => {
    if (value === undefined) trace.push({ text: fmt(label) });
    else trace.push({ label: String(label), text: fmt(value) });
  };
  const resultFn = (label: unknown, value?: unknown): void => {
    if (value === undefined) {
      trace.push({ text: fmt(label), out: true });
    } else {
      trace.push({ label: String(label), text: fmt(value), out: true });
      out[String(label)] = toValue(value);
    }
  };

  const params = [...BLOCKED_GLOBALS, "console", "trace", "result"];
  const args = [...BLOCKED_GLOBALS.map(() => undefined), sandboxConsole, traceFn, resultFn];

  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn = new Function(...params, `"use strict";\n${source}\n`);
    (fn as (...a: unknown[]) => unknown)(...args);
    return { ok: true, log, trace, error: null, out };
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    return { ok: false, log, trace, error: msg, out };
  }
}

export const jsHarness: Harness = {
  id: "js-real-execution",
  kind: "real-execution",
  languages: ["javascript", "js"],
  run: runJs,
};
