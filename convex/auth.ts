import type { MutationCtx, QueryCtx, ActionCtx } from "./_generated/server";

type ConvexCtx = QueryCtx | MutationCtx;

export async function getAuthenticatedUserId(ctx: ConvexCtx): Promise<string | null> {
    const identity = await ctx.auth.getUserIdentity();
    return identity?.subject ?? null;
}

export async function getAuthenticatedUserIdForAction(ctx: ActionCtx): Promise<string | null> {
    const identity = await ctx.auth.getUserIdentity();
    return identity?.subject ?? null;
}
