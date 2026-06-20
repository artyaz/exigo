/* ═══════════════════════════════════════════════════════════════════
   EXIGO AAP — JS observation harness (v4).
   The browser-facing wrapper around jsObservationCore: it runs the core
   inside a *terminable* Web Worker with a hard timeout, so an infinite
   loop in learner code is killed rather than freezing the tab. In non-DOM
   environments (SSR, vitest) it falls back to the synchronous core.
   ═══════════════════════════════════════════════════════════════════ */
import type { ObservationHarness, ObservationRun, RunResult, TraceStep } from "./types";
import {
  JS_OBSERVATION_SCHEMA,
  JS_OBSERVATION_SYMBOLS,
  runObservationsSync,
} from "./jsObservationCore";
import type { Observation } from "./types";

const DEFAULT_TIMEOUT_MS = 2000;

/** Render one observation as a trace row (for the codeProbe trace view). */
function obsToTrace(o: Observation): TraceStep {
  const { kind, t, ...rest } = o;
  void t;
  const body = Object.entries(rest)
    .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join("  ");
  return { label: kind, text: body };
}

/** Run source in a terminable Worker; resolve a timeout result if it hangs. */
export function runObservationsWorker(
  source: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<ObservationRun> {
  // node / SSR: no Worker — run synchronously (tests cover this path).
  if (typeof Worker === "undefined") return Promise.resolve(runObservationsSync(source));

  return new Promise<ObservationRun>((resolve) => {
    let settled = false;
    let worker: Worker;
    try {
      worker = new Worker(new URL("./jsObservationWorker.ts", import.meta.url), { type: "module" });
    } catch {
      // Worker construction unsupported in this context — degrade gracefully.
      resolve(runObservationsSync(source));
      return;
    }
    const finish = (r: ObservationRun): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      resolve(r);
    };
    const timer = setTimeout(() => {
      finish({
        ok: false,
        error: `Run timed out after ${timeoutMs}ms (possible infinite loop).`,
        observations: [],
        log: [],
      });
    }, timeoutMs);
    worker.onmessage = (e: MessageEvent<ObservationRun>) => finish(e.data);
    worker.onerror = (e) => finish({ ok: false, error: `Worker error: ${e.message}`, observations: [], log: [] });
    worker.postMessage({ source });
  });
}

export const jsObservationHarness: ObservationHarness = {
  id: "js-observation",
  kind: "real-execution",
  languages: ["javascript", "js"],
  observationSchema: JS_OBSERVATION_SCHEMA,
  symbols: JS_OBSERVATION_SYMBOLS,
  /** Legacy synchronous trace, derived from the observation stream. */
  run(source: string): RunResult {
    const r = runObservationsSync(source);
    return { ok: r.ok, error: r.error, log: r.log, trace: r.observations.map(obsToTrace), out: {} };
  },
  runObservations(source: string): Promise<ObservationRun> {
    return runObservationsWorker(source);
  },
};
