import posthog from "posthog-js";

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  defaults: "2026-01-30",
});

window.addEventListener("error", (event) => {
  const exception =
    event.error instanceof Error ? event.error : new Error(event.message);
  posthog.captureException(exception, { source: "window.error" });
});

window.addEventListener("unhandledrejection", (event) => {
  const exception =
    event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason));
  posthog.captureException(exception, { source: "window.unhandledrejection" });
});
