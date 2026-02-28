import "server-only";

import { ConvexHttpClient } from "convex/browser";

type GetTokenFn = (options?: { template?: string }) => Promise<string | null>;

export class ConvexAuthError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ConvexAuthError";
    }
}

function getFunctionName(functionRef: unknown): string {
    if (typeof functionRef === "string") {
        return functionRef;
    }
    if (functionRef && typeof functionRef === "object") {
        const ref = functionRef as { _name?: unknown; name?: unknown };
        if (typeof ref._name === "string") {
            return ref._name;
        }
        if (typeof ref.name === "string") {
            return ref.name;
        }
    }
    return "unknown";
}

async function captureConvexException(
    error: unknown,
    properties: Record<string, string>,
): Promise<void> {
    if (
        !process.env.NEXT_PUBLIC_POSTHOG_KEY ||
        !process.env.NEXT_PUBLIC_POSTHOG_HOST
    ) {
        return;
    }
    try {
        const { getPostHogServer } = await import("./posthog-server");
        const posthog = getPostHogServer();
        const exception =
            error instanceof Error ? error : new Error(String(error));
        posthog.captureException(exception, undefined, properties);
    } catch (captureError) {
        console.error("PostHog capture failed:", captureError);
    }
}

export function getConvexUrlOrThrow(context: string): string {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) {
        throw new Error(`[${context}] NEXT_PUBLIC_CONVEX_URL is missing.`);
    }
    return url;
}

export async function fetchConvexTemplateTokenOrThrow(getToken: GetTokenFn, context: string): Promise<string> {
    const token = await getToken({ template: "convex" });
    if (!token) {
        throw new ConvexAuthError(
            `[${context}] Missing Convex template token. Ensure Clerk token template "convex" is configured.`
        );
    }
    return token;
}

export async function createAuthedConvexClient(
    getToken: GetTokenFn,
    context: string
): Promise<ConvexHttpClient> {
    const url = getConvexUrlOrThrow(context);
    const token = await fetchConvexTemplateTokenOrThrow(getToken, context);
    const convex = new ConvexHttpClient(url);
    convex.setAuth(token);
    const proxied: ConvexHttpClient = new Proxy(convex, {
        get(target, prop, receiver) {
            const value = Reflect.get(target, prop, receiver) as unknown;
            if (
                (prop === "query" || prop === "mutation" || prop === "action") &&
                typeof value === "function"
            ) {
                const callable = value as (...callArgs: unknown[]) => Promise<unknown>;
                return async (...args: unknown[]) => {
                    try {
                        return await callable(...args);
                    } catch (error) {
                        await captureConvexException(error, {
                            source: "convex-client",
                            context,
                            operation: String(prop),
                            functionName: getFunctionName(args[0]),
                        });
                        throw error;
                    }
                };
            }
            return value;
        },
    });

    return proxied;
}
