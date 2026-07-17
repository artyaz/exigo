/* Dedicated Web Worker entry for the JS observation harness. Runs the
   learner's code off the main thread so a hard timeout can terminate() a
   runaway program. Pure relay: { source } in → ObservationRun out. */
import { runObservationsSync } from "./jsObservationCore";

const ctx = self as unknown as Worker;

ctx.onmessage = (e: MessageEvent<{ source: string }>): void => {
  const result = runObservationsSync(e.data?.source ?? "");
  ctx.postMessage(result);
};
