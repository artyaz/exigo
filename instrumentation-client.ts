import posthog from "posthog-js";

if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  });
}

globalThis.addEventListener("error", (event) => {
  const exception =
    event.error instanceof Error ? event.error : new Error(event.message);
  if ((exception as unknown as Record<string, unknown>).__posthogCaptured) return;
  Object.defineProperty(exception, "__posthogCaptured", { value: true, enumerable: false });
  posthog.captureException(exception, { source: "window.error" });
});

globalThis.addEventListener("unhandledrejection", (event) => {
  const exception =
    event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason));
  if ((exception as unknown as Record<string, unknown>).__posthogCaptured) return;
  Object.defineProperty(exception, "__posthogCaptured", { value: true, enumerable: false });
  posthog.captureException(exception, { source: "window.unhandledrejection" });
});
