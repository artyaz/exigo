# Fix pack P0-A — userSettings auth

**Findings:** F-S3-002, F-S9-001  
**Brain:** S3-B002 / S9-B006 — Approach A (auth-derived userId; drop client `userId` args)

## What changed

### `convex/userSettings.ts`
- `getMine`, `getCipher`, and `save` now call `getAuthenticatedUserId(ctx)` and key all reads/writes by that subject only.
- Removed `userId` from all args validators — client cannot supply another user’s id.
- Cipher remains opaque (still no decrypt in Convex).

### `src/app/actions/aiSettings.ts`
- `getMine` / `save` refs no longer type or pass `userId`.
- Clerk `auth()` still gates the server action and supplies the JWT via `createAuthedConvexClient`; Convex re-derives identity from that token.

### `src/server/ai/resolve.ts`
- `getCipher` called with `{}`; `resolveAiProvider(convex)` no longer takes `userId`.
- Relies on the authed Convex HTTP client’s JWT for identity.

### Call sites (compile)
- `src/app/api/generate/{open,atlas,exercise,lesson,lesson-exercises,embed}/route.ts` — dropped second arg to `resolveAiProvider`.

## Risks

| Risk | Notes |
|------|--------|
| Unauthenticated Convex call | Functions throw `UNAUTHORIZED` ConvexError — callers already use authed clients. |
| `getCipher` still public query | Authenticated user can read **own** cipher from browser; useless without app encrypt secret. Optional hardening: `internalQuery` + server-only path. |
| Deploy order | Deploy Convex before Next so empty-args validators match clients. |
| Silent fallback | Unchanged: `resolveAiProvider` still falls back to default Gemini on query/decrypt failure. |

## Follow-ups (out of pack)

1. Prefer generated `api.userSettings.*` over `makeFunctionReference` once codegen is the house style (S9 slice note).
2. Consider making `getCipher` internal if we want cipher never on the public client surface.
3. Product AI routes (learn/tests) still bypass `resolveAiProvider` — intentional dual stack; not this pack.

## Tests

No dedicated unit tests for `userSettings`. `tsc` on touched paths clean (unrelated pre-existing `.next/types` noise only). Manual smoke: signed-in get/save settings; generate route still resolves provider.
