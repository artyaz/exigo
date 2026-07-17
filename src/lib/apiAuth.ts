import "server-only";

import { auth } from "@clerk/nextjs/server";
import type { ConvexHttpClient } from "convex/browser";
import {
  ConvexAuthError,
  createAuthedConvexClient,
} from "./convexClientAuth";
import { getErrorAttributes, logError } from "./otlpLogger";

type GetTokenFn = (options?: { template?: string }) => Promise<string | null>;

export type ApiSession = {
  userId: string;
  getToken: GetTokenFn;
};

export type AuthedConvex = {
  userId: string;
  convex: ConvexHttpClient;
};

export type AuthLogContext = {
  requestId?: string;
  route?: string;
  duration_ms?: number;
};

/** Stable public JSON error — never leak stack / Convex context / err.message */
export function jsonError(
  status: number,
  error: string,
  extra?: Record<string, unknown>,
): Response {
  return new Response(JSON.stringify({ error, ...extra }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Clerk session gate: 401 if no userId */
export async function requireApiSession(): Promise<ApiSession | Response> {
  const { userId, getToken } = await auth();
  if (!userId) {
    return jsonError(401, "Unauthorized");
  }
  return { userId, getToken };
}

/**
 * Build authed ConvexHttpClient from an already-checked session.
 * 401 on missing Convex template token; 500 opaque otherwise (logged).
 */
export async function requireAuthedConvex(
  session: ApiSession,
  context: string,
  logCtx?: AuthLogContext,
): Promise<{ convex: ConvexHttpClient } | Response> {
  try {
    const convex = await createAuthedConvexClient(session.getToken, context);
    return { convex };
  } catch (error) {
    if (error instanceof ConvexAuthError) {
      return jsonError(401, "Unauthorized");
    }
    logError("Failed to initialize Convex client", {
      source: context,
      requestId: logCtx?.requestId,
      route: logCtx?.route,
      userId: session.userId,
      duration_ms: logCtx?.duration_ms,
      ...getErrorAttributes(error),
    });
    return jsonError(500, "Internal server error");
  }
}

/**
 * Full auth gate: Clerk userId + authed Convex client.
 * Returns Response on failure for early-return: `if (authResult instanceof Response) return authResult`.
 */
export async function requireAuthedApi(
  context: string,
  logCtx?: AuthLogContext,
): Promise<AuthedConvex | Response> {
  const session = await requireApiSession();
  if (session instanceof Response) return session;

  const result = await requireAuthedConvex(session, context, logCtx);
  if (result instanceof Response) return result;

  return { userId: session.userId, convex: result.convex };
}
