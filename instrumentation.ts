import {
  createRequestId,
  getErrorAttributes,
  logError,
  logWarn,
  registerOtelLogger,
} from "./src/lib/otlpLogger";

export function register() {
  registerOtelLogger();
}

function normalizeException(err: unknown): Error {
  if (err instanceof Error && typeof err.stack === "string") {
    return err;
  }
  if (err instanceof Error) {
    return new Error(err.message);
  }
  return new Error(String(err));
}

function extractDistinctId(
  headers: { cookie?: string | string[]; get?: (name: string) => string | null },
  requestId: string,
): string | undefined {
  if (!headers.cookie) return undefined;
  const cookieString = Array.isArray(headers.cookie)
    ? headers.cookie.join("; ")
    : headers.cookie;
  const match = /ph_phc_.*?_posthog=([^;]+)/.exec(cookieString);
  if (!match?.[1]) return undefined;
  try {
    const decoded = decodeURIComponent(match[1]);
    const data = JSON.parse(decoded) as { distinct_id?: string };
    return data.distinct_id ?? undefined;
  } catch (e) {
    logWarn("Failed to parse PostHog cookie", {
      requestId,
      route: "next.onRequestError",
      ...getErrorAttributes(e),
    });
    return undefined;
  }
}

export const onRequestError = async (
  err: unknown,
  request: {
    method?: string;
    url?: string;
    headers: { cookie?: string | string[]; get?: (name: string) => string | null };
  },
  _context: unknown,
) => {
  const requestId =
    typeof request.headers.get === "function"
      ? createRequestId({ get: (name) => request.headers.get?.(name) ?? null })
      : crypto.randomUUID();

  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Dynamic import keeps posthog-node out of non-nodejs instrumentation bundles.
    const { getPostHogServer } = await import("./src/lib/posthog-server");
    const posthog = getPostHogServer();
    if (!posthog) {
      logWarn("PostHog env vars missing; skipping exception capture", {
        requestId,
        route: request.url ?? "unknown",
        missingKey: !process.env.NEXT_PUBLIC_POSTHOG_KEY,
        missingHost: !process.env.NEXT_PUBLIC_POSTHOG_HOST,
      });
    } else {
      const distinctId = extractDistinctId(request.headers, requestId);
      posthog.captureException(normalizeException(err), distinctId, {
        source: "next.onRequestError",
      });
      // Flush only — do not shutdown the shared Next singleton.
      await posthog.flush();
    }
  }

  logError("Unhandled request error captured", {
    requestId,
    route: request.url ?? "unknown",
    method: request.method ?? "unknown",
    ...getErrorAttributes(err),
  });
};
