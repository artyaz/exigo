/* Bounded parallelism + retry. The pyramid fans out wide (potentially ~75
   exercises × 2 calls), so every LLM call goes through ONE shared limiter that
   caps how many run at once, and a retry wrapper for the flaky endpoint. */

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** A shared gate: `run(fn)` resolves with fn's result but never lets more than
    `max` run concurrently — the rest queue. Used for every provider call so the
    whole tree, however nested its fan-out, stays within one global budget. */
export function createLimiter(max: number): <T>(fn: () => Promise<T>) => Promise<T> {
  let active = 0;
  const queue: (() => void)[] = [];
  const pump = (): void => {
    if (active >= max) return;
    const job = queue.shift();
    if (!job) return;
    active++;
    job();
  };
  return function run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(() => {
        fn().then(resolve, reject).finally(() => {
          active--;
          pump();
        });
      });
      pump();
    });
  };
}

/** Retry with linear backoff; throws a labelled error after `tries` failures. */
export async function withRetry<T>(fn: () => Promise<T>, tries: number, label: string): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (i < tries - 1) await sleep(300 * (i + 1));
    }
  }
  throw new Error(`${label} failed after ${tries} attempt(s): ${last instanceof Error ? last.message : String(last)}`);
}
