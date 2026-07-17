# Fix pack P1-B — SSE + auth consistency helpers

**Findings:** S8-B001 (SSE wire/headers fork), S8-B003 (auth gate + public error contract)  
**Brain:** Approach A for both — shared helpers; migrate hot-path AI routes; no mega rewrite

## What changed

### New helpers

| File | Role |
|------|------|
| `src/lib/sse.ts` | Majority dialect framing (`sseData` / `sseDelta` / `sseDone` / `sseError`), residual `sseNamedEvent`, unified `SSE_HEADERS` (`no-cache, no-transform` + `X-Accel-Buffering: no`), `sseResponse`, `enqueueSseError` |
| `src/lib/apiAuth.ts` | `jsonError`, `requireApiSession`, `requireAuthedConvex`, `requireAuthedApi` — Clerk userId + authed Convex; public 401 `"Unauthorized"` / 500 `"Internal server error"` (no token-context leaks) |
| `src/lib/sse.test.ts` | Framing + header unit tests |

### Migrated routes (owned scope)

| Route | Auth helper | SSE / errors |
|-------|-------------|--------------|
| `api/learn/teach` | `requireAuthedApi` | `sseDelta`/`sseDone`/`enqueueSseError` + `sseResponse` |
| `api/learn/clarify` | `requireAuthedApi` | same; stream failures now otlp-logged (were silent) |
| `api/tests/generate` | `requireAuthedApi` | opaque stream error `"Test generation failed"` (was `err.message`) |
| `api/tests/chat` | `requireAuthedApi` | **adds missing userId gate**; stable 401/500 |
| `api/tests/feels-hard` | `requireAuthedApi` | 500 no longer leaks `err.message` |

### Tutor (dialect preserved)

- `api/learn/tutor` still uses **named** SSE events (`event: …\ndata: …`) required by `CourseTutor.tsx`.
- Local `sseEvent` now delegates to `sseNamedEvent` so framing has one implementation; auth still hand-rolled (not fully migrated — residual below).

## Public contract notes

- Auth 401 body standardized to `{ error: "Unauthorized" }` (dropped `"Unauthorized: Missing Convex auth token."` on migrated routes). Clients should not match on the longer string.
- Stream `done` product payloads unchanged (`isComplete`, `testId`/`questionId`, etc.).
- Plan-limit 403 messages on generate/chat left as product copy (not the generic `"Forbidden"` placeholder).

## Residual (out of pack / intentional)

1. **Tutor named-event dialect** — keep until S7 co-migrates `CourseTutor.tsx` to type-in-JSON.
2. **`api/learn/tutor` auth** — still uses local `createAuthedConvexClient` + `ConvexAuthError` catch; not switched to `requireAuthedApi` (larger route; wire format priority only).
3. **`api/tests/validate`** — still hand auth; opaque 500 already; easy follow-up.
4. **`api/generate/*` playground / atlas / embed** — out of ownership; still leak `e.message` / uncaught ConvexAuthError per S8-B003.
5. **Checkout unauthed Convex** — payments hygiene; not this pack.
6. **Shared client SSE parser** — S7; servers now share framing helpers only.

## Risks

| Risk | Notes |
|------|--------|
| Client string-match on 401 text | Migrated routes shortened auth error; grep clients for long phrase if any |
| Generate stream errors more opaque | Clients may have shown `err.message`; now fixed copy + server logs |
| Header change on teach/generate | Added `no-transform` + `X-Accel-Buffering: no` (clarify already had) — improves proxy buffering, low risk |

## Tests

- `npm run test -- src/lib/sse.test.ts` — pass
- `tsc --noEmit` — no errors on touched paths

## Follow-ups

1. Migrate `validate` + full tutor auth to `requireAuthedApi`.
2. Tutor client+server protocol unification (type-in-payload) with S7.
3. Sweep `generate/*` for auth/error helpers when that pack owns them.
