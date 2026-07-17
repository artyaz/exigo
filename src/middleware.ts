import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Session-owned product surfaces. Public routes stay open by omission:
// `/`, `/pricing`, `/terms`, `/sign-in`, `/sign-up`, `/sso-callback`, and static assets.
// API routes run through this middleware but do not call protect() — handlers use auth().
const isProtectedRoute = createRouteMatcher([
    '/spaces(.*)',
    '/tests(.*)',
    '/settings(.*)',
    '/knowledge-nodes(.*)',
    '/checkout(.*)',
    '/playground(.*)',
]);

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
