import { auth } from "@clerk/nextjs/server";

/**
 * Extract the plan slug from Clerk session claims' private metadata.
 * Returns undefined if no plan is set (treated as "free").
 */
export async function getPlanFromAuth(): Promise<string | undefined> {
    const { sessionClaims } = await auth();
    if (!sessionClaims) return undefined;
    const meta = (sessionClaims as Record<string, unknown>).privateMetadata as
        | { plan?: string }
        | undefined;
    return meta?.plan ?? undefined;
}
