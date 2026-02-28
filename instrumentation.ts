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
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
    if (!key || !host) {
      return;
    }

    const { PostHog } = await import("posthog-node");
    const posthog = new PostHog(key, {
      host,
      flushAt: 1,
      flushInterval: 0,
    });

    let distinctId: string | undefined = undefined;

    if (request.headers.cookie) {
      const cookieString = Array.isArray(request.headers.cookie)
        ? request.headers.cookie.join("; ")
        : request.headers.cookie;

      const postHogCookieMatch = cookieString.match(
        /ph_phc_.*?_posthog=([^;]+)/,
      );
      if (postHogCookieMatch?.[1]) {
        try {
          const decodedCookie = decodeURIComponent(postHogCookieMatch[1]);
          const postHogData = JSON.parse(decodedCookie) as {
            distinct_id?: string;
          };
          distinctId = postHogData.distinct_id ?? undefined;
        } catch (e) {
          logWarn("Failed to parse PostHog cookie", {
            requestId,
            route: "next.onRequestError",
            ...getErrorAttributes(e),
          });
        }
      }
    }

    posthog.captureException(normalizeException(err), distinctId, {
      source: "next.onRequestError",
    });
    await posthog._shutdown(2000);
  }

  logError("Unhandled request error captured", {
    requestId,
    route: request.url ?? "unknown",
    method: request.method ?? "unknown",
    ...getErrorAttributes(err),
  });
};
