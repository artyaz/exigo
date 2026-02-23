import "server-only";

import { ConvexHttpClient } from "convex/browser";

type GetTokenFn = (options?: { template?: string }) => Promise<string | null>;

export class ConvexAuthError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ConvexAuthError";
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
    return convex;
}
