import "server-only";
import type { AiProvider, AiGenerateRequest, AiChunk, AiResult } from "./types";

export interface RetryOpts {
  /** Max attempts (including the first). Default 3. */
  maxAttempts?: number;
  /** Base delay in ms before the first retry. Default 2000. */
  baseMs?: number;
  /** Maximum delay cap in ms. Default 15000. */
  capMs?: number;
  /** Called on each retry for logging/alerting. */
  onRetry?: (info: { attempt: number; status: number; delayMs: number }) => void;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_MS = 2000;
const DEFAULT_CAP_MS = 15000;

function isRateLimited(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { status?: number }).status === 429;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function backoff(attempt: number, baseMs: number, capMs: number): number {
  const exponential = baseMs * 2 ** attempt;
  const jitter = Math.random() * baseMs * 0.3;
  return Math.min(exponential + jitter, capMs);
}

/**
 * Wraps an AiProvider with 429-retry policy (exponential backoff + jitter).
 * Retry is policy, not transport — kept separate from vendor adapters.
 *
 * For streaming: if a 429 occurs before or during iteration, the entire
 * generation restarts from scratch (clients accumulate via full-replace).
 */
export function withRetry(provider: AiProvider, opts?: RetryOpts): AiProvider {
  const maxAttempts = opts?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseMs = opts?.baseMs ?? DEFAULT_BASE_MS;
  const capMs = opts?.capMs ?? DEFAULT_CAP_MS;

  return {
    config: provider.config,

    async generate(req: AiGenerateRequest): Promise<AiResult> {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          return await provider.generate(req);
        } catch (e) {
          if (isRateLimited(e) && attempt < maxAttempts - 1) {
            const waitMs = backoff(attempt, baseMs, capMs);
            opts?.onRetry?.({ attempt: attempt + 1, status: 429, delayMs: waitMs });
            await delay(waitMs);
            continue;
          }
          throw e;
        }
      }
      // Unreachable, but satisfies TS
      throw new Error("withRetry: exhausted attempts");
    },

    async *stream(req: AiGenerateRequest): AsyncIterable<AiChunk> {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          for await (const chunk of provider.stream(req)) {
            yield chunk;
          }
          return;
        } catch (e) {
          if (isRateLimited(e) && attempt < maxAttempts - 1) {
            const waitMs = backoff(attempt, baseMs, capMs);
            opts?.onRetry?.({ attempt: attempt + 1, status: 429, delayMs: waitMs });
            await delay(waitMs);
            continue;
          }
          throw e;
        }
      }
      throw new Error("withRetry: exhausted attempts");
    },
  } satisfies AiProvider;
}
