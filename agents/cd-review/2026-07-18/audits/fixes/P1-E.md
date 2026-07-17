# Fix pack P1-E — Expand middleware protected matchers

**Findings:** F-S10-001  
**Brain:** S10-B001 — Approach A (expand `createRouteMatcher` list)

## What changed

### `src/middleware.ts`
- Expanded `isProtectedRoute` beyond `/spaces(.*)` and `/tests(.*)` to also match:
  - `/settings(.*)` — AI provider keys / preferences
  - `/knowledge-nodes(.*)` — knowledge node UI
  - `/checkout(.*)` — paid plan checkout
  - `/playground(.*)` — exercise authoring / generation harness
- Left protection as prefix matchers + `auth.protect()` only (no public-allowlist inversion, no API `protect()`).
- Comment documents intentional public surfaces: `/`, `/pricing`, `/terms`, `/sign-in`, `/sign-up`, `/sso-callback`.
- Comment notes API routes still go through middleware but rely on handler `auth()` (webhooks stay ungated by design).

## Risks

| Risk | Notes |
|------|--------|
| Playground locked for demos | Product intent treated as session-owned per S10-B001 + pack brief; if demos must be anonymous, drop `/playground(.*)` and document it as public in the middleware comment. |
| New session routes forgotten | Matcher is an explicit list; when adding app surfaces, add a matcher. Approach B (public allowlist) remains a future option. |
| Checkout signed-out redirect | Expected: pricing stays public; clicking checkout without a session hits Clerk protect then returns after sign-in. |
| API / webhooks | Unchanged — no `/api/*` in protected matchers; Paddle webhook and similar stay open. |

## Follow-ups (out of pack)

1. When product adds more session UI outside these prefixes, extend the matcher in the same file.
2. Optional later: invert to public allowlist (S10-B001 Approach B) if the protected surface grows faster than public marketing pages.

## Tests

No automated middleware tests in repo. Manual:

1. Signed-out → `/settings`, `/knowledge-nodes`, `/checkout`, `/playground` → Clerk protect redirect (same behavior as `/spaces`).
2. Signed-out → `/`, `/pricing`, `/terms`, `/sign-in`, `/sign-up` stay reachable.
3. Signed-in → protected routes load normally.
4. `POST /api/webhooks/paddle` (or other public API) still does not require Clerk session at the edge.
