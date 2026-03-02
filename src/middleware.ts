import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { slugToTier, tierToAccessLevel } from '../shared/planConfig'

const isProtectedRoute = createRouteMatcher(['/spaces(.*)', '/tests(.*)']);

type PrivateMetadata = {
    plan?: string;
    expiresAt?: number;
    paddleSubscriptionId?: string;
};

function getPrivateMetadata(sessionClaims: Record<string, unknown> | null): PrivateMetadata {
    if (!sessionClaims) return {};
    const meta = sessionClaims.privateMetadata as PrivateMetadata | undefined;
    return meta ?? {};
}

function hasValidSubscription(meta: PrivateMetadata): boolean {
    if (!meta.plan || !meta.expiresAt) return false;
    return meta.expiresAt > Date.now();
}

function getUserAccessLevel(meta: PrivateMetadata): number {
    if (!hasValidSubscription(meta)) return 0;
    const tier = slugToTier(meta.plan);
    return tierToAccessLevel(tier);
}

/**
 * Check if user's plan level meets the required level for a route/action.
 */
export function requirePlanLevel(
    meta: PrivateMetadata,
    requiredLevel: number,
): boolean {
    return getUserAccessLevel(meta) >= requiredLevel;
}

export default clerkMiddleware(async (auth, req) => {
    if (isProtectedRoute(req)) await auth.protect();
})

export const config = {
    matcher: [
        // Skip Next.js internals and all static files, unless found in search params
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        // Always run for API routes
        '/(api|trpc)(.*)',
    ],
}
