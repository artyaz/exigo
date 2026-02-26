import { ConvexError } from "convex/values";
import type { QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";
import {
  getEffectiveAccessLevel,
  getEffectiveLimits,
  getEffectiveAccessLevelForAction,
  getEffectiveLimitsForAction,
  ACCESS_LEVELS,
  type AccessLevel,
  type PlanLimits,
  PLAN_LIMIT_CODE,
} from "./subscriptionService";

export interface AuthedContext {
  userId: string;
  accessLevel: AccessLevel;
  limits: PlanLimits;
}

export type AuthedQueryCtx = QueryCtx & AuthedContext;
export type AuthedMutationCtx = MutationCtx & AuthedContext;
export type AuthedActionCtx = ActionCtx & AuthedContext;

export async function getAuthedContext(
  ctx: QueryCtx | MutationCtx,
): Promise<AuthedContext> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) {
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: "Not authenticated",
    });
  }

  const userId = identity.subject;
  const accessLevel = await getEffectiveAccessLevel(ctx, userId);
  const limits = await getEffectiveLimits(ctx, userId);

  return { userId, accessLevel, limits };
}

export async function getAuthedContextForAction(
  ctx: ActionCtx,
): Promise<AuthedContext> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) {
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: "Not authenticated",
    });
  }

  const userId = identity.subject;
  const accessLevel = await getEffectiveAccessLevelForAction(ctx, userId);
  const limits = await getEffectiveLimitsForAction(ctx, userId);

  return { userId, accessLevel, limits };
}

export async function withAuth<T>(
  ctx: QueryCtx | MutationCtx,
  handler: (ctx: QueryCtx & AuthedContext, auth: AuthedContext) => Promise<T>,
): Promise<T> {
  const auth = await getAuthedContext(ctx);
  return handler(ctx as QueryCtx & AuthedContext, auth);
}

export async function withAuthAction<T>(
  ctx: ActionCtx,
  handler: (ctx: ActionCtx & AuthedContext, auth: AuthedContext) => Promise<T>,
): Promise<T> {
  const auth = await getAuthedContextForAction(ctx);
  return handler(ctx as ActionCtx & AuthedContext, auth);
}

export function requireMinAccessLevel(
  auth: AuthedContext,
  minLevel: AccessLevel,
): void {
  if (auth.accessLevel < minLevel) {
    throw new ConvexError({
      code: PLAN_LIMIT_CODE,
      message: "This feature requires a higher subscription tier.",
    });
  }
}

export function requireProAccess(auth: AuthedContext): void {
  requireMinAccessLevel(auth, ACCESS_LEVELS.PRO_SCHOLAR);
}

export async function getAuthenticatedUserId(
  ctx: QueryCtx | MutationCtx,
): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) {
    throw new Error("Unauthorized: No identity found");
  }
  return identity.subject;
}
