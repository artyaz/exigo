# Fix pack P3-F — Finish API auth/SSE consistency (validate + tutor auth)

**Parent residual:** P1-B residual items 2–3  
**Findings lineage:** S8-B003 (auth gate + public error contract)

## What changed

### `api/tests/validate`

| Before | After |
|--------|--------|
| Hand-rolled `auth()` + `createAuthedConvexClient` | `requireAuthedApi("api.tests.validate", { requestId, route, duration_ms })` |
| Outer catch returned `"Unauthorized: Missing Convex auth token."` on `ConvexAuthError` | Auth failures handled by helper → opaque 401 `"Unauthorized"`; outer catch only opaque 500 |
| Mixed `NextResponse.json({ error })` for 4xx | Client-facing errors via `jsonError` (same `{ error }` shape) |

Product 403 copy (Educator plan for write AI feedback) and 404/space ownership messages preserved.

### `api/learn/tutor` (auth path only)

| Before | After |
|--------|--------|
| Hand-rolled `auth()` + `createAuthedConvexClient` + `ConvexAuthError` catch returning **`e.message`** | `requireAuthedApi("api.learn.tutor")` — stable 401 `"Unauthorized"` / 500 `"Internal server error"` |
| 400 via raw `Response` | `jsonError(400, "Missing spaceId or message")` |

**Unchanged (intentional):**

- Named SSE dialect (`sseNamedEvent` / `event: tool_call` / …) — still required by `CourseTutor.tsx`
- Response headers on the stream body (still local `Cache-Control: no-cache` etc.; not forced onto majority `SSE_HEADERS`)
- Stream error payload `{ error: "Tutor request failed" }` (opaque already)

### Helpers

No changes to `src/lib/apiAuth.ts` or `src/lib/sse.ts` — existing `requireAuthedApi` / `jsonError` sufficient.

## Public contract notes

- Validate no longer returns the long Convex-token 401 string; clients must treat 401 as unauthorized, not match that phrase.
- Tutor 401 body is now `{ error: "Unauthorized" }` (was sometimes `ConvexAuthError.message`).
- Validate success body (`isCorrect`, `aiFeedback`, optional `_meta.modelUsed`) unchanged.

## Residual

1. **Tutor named-event dialect** — keep until S7 co-migrates `CourseTutor.tsx` to type-in-JSON; optionally align stream headers with `SSE_HEADERS` when that lands.
2. **`api/generate/*` playground / atlas / embed** — still out of ownership (S8-B003 leaks).
3. **Checkout unauthed Convex** — payments hygiene; not this pack.
4. **Shared client SSE parser** — S7.

## Risks

| Risk | Notes |
|------|--------|
| Client string-match on validate 401 text | Long phrase removed; grep if any client depended on it |
| Tutor 401 body shortened | Same as other migrated routes |

## Tests

- `npx tsc --noEmit` — pass (no errors on touched paths)

## Follow-ups

1. Tutor client+server protocol unification (type-in-payload) with S7; then switch tutor to majority dialect + `sseResponse`/`SSE_HEADERS`.
2. Sweep `generate/*` for auth/error helpers when that pack owns them.
