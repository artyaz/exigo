import { PostHog } from "posthog-node";

let posthogInstance: PostHog | null = null;

export function getPostHogServer(): PostHog {
  const key = process.env.POSTHOG_PROJECT_TOKEN ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) {
    throw new Error("getPostHogServer: missing POSTHOG_PROJECT_TOKEN (or NEXT_PUBLIC_POSTHOG_KEY fallback).");
  }
  const flushAt = process.env.POSTHOG_FLUSH_AT ? parseInt(process.env.POSTHOG_FLUSH_AT, 10) : 1;
  const flushInterval = process.env.POSTHOG_FLUSH_INTERVAL ? parseInt(process.env.POSTHOG_FLUSH_INTERVAL, 10) : 0;
  posthogInstance ??= new PostHog(key, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    flushAt,
    flushInterval,
  });
  return posthogInstance;
}
