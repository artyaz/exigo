import "server-only";

import { PostHog } from "posthog-node";

/**
 * Sole posthog-node singleton for the Next.js server runtime.
 * Soft-fails to null when NEXT_PUBLIC_POSTHOG_KEY is missing (callers no-op).
 * Do not import from shared/ or Convex — use shared/posthogAiObservability there.
 */
let posthogInstance: PostHog | null = null;

export function getPostHogServer(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) {
    return null;
  }
  const flushAt = process.env.POSTHOG_FLUSH_AT
    ? parseInt(process.env.POSTHOG_FLUSH_AT, 10)
    : 1;
  const flushInterval = process.env.POSTHOG_FLUSH_INTERVAL
    ? parseInt(process.env.POSTHOG_FLUSH_INTERVAL, 10)
    : 0;
  posthogInstance ??= new PostHog(key, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    flushAt,
    flushInterval,
  });
  return posthogInstance;
}
