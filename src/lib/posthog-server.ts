import { PostHog } from "posthog-node";

let posthogInstance: PostHog | null = null;

export function getPostHogServer(): PostHog {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    throw new Error("getPostHogServer: NEXT_PUBLIC_POSTHOG_KEY is not set. Ensure the environment variable is configured.");
  }
  const flushAt = process.env.POSTHOG_FLUSH_AT ? parseInt(process.env.POSTHOG_FLUSH_AT, 10) : 1;
  const flushInterval = process.env.POSTHOG_FLUSH_INTERVAL ? parseInt(process.env.POSTHOG_FLUSH_INTERVAL, 10) : 0;
  posthogInstance ??= new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    flushAt,
    flushInterval,
  });
  return posthogInstance;
}
