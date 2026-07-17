# Fix Pack P3-E — Authenticate getPrompt / prompt access

**Findings:** F-S2-007  
**Brain:** S2-B005 approach A (`require auth on getPrompt`; keep `getPromptInternal` for trusted backends)  
**Status:** done

## Summary

`coursePrompts.getPrompt` was a public Convex query with **no auth** — anyone who could hit the deployment URL could fetch named system prompts (product IP + injection templates). Next SSE/API routes already call it through a user-JWT `ConvexHttpClient` (`requireAuthedApi` / `convexClientAuth`), and Convex actions already use `internal.coursePrompts.getPromptInternal`. Requiring `getAuthenticatedUserId(ctx)` at the top of `getPrompt` stops anonymous scrape without breaking legitimate call sites.

## Per-finding

| ID | Sev | Status | What changed |
|----|-----|--------|--------------|
| F-S2-007 | P1 | **done** | `getPrompt` now calls `getAuthenticatedUserId(ctx)` before DB read; unauthed → `UNAUTHORIZED` ConvexError |

## Call sites

| Path | Access | Needs change? |
|------|--------|---------------|
| `src/app/api/learn/teach/route.ts` | `api.coursePrompts.getPrompt` via authed client | No — already JWT |
| `src/app/api/learn/clarify/route.ts` | same | No |
| `src/app/api/learn/tutor/route.ts` | same (2×) | No |
| `src/app/api/tests/generate/route.ts` | same | No |
| `src/app/api/tests/validate/route.ts` | same | No |
| `src/app/api/tests/feels-hard/route.ts` | same | No |
| `src/app/api/knowledge/title/route.ts` | same | No |
| `convex/courseAi.ts` | `internal.coursePrompts.getPromptInternal` | No — internal |
| `convex/knowledgeNodes.ts` | `getPromptInternal` | No |
| `convex/testMessages.ts` | `getPromptInternal` | No |

No client-side React `useQuery(api.coursePrompts.getPrompt)` found.

## Files touched

| File | Change |
|------|--------|
| `convex/coursePrompts.ts` | import `getAuthenticatedUserId`; gate `getPrompt`; comment public vs internal |
| `audits/fixes/P3-E.md` | this writeup |

## Explicitly not changed

- `getPromptInternal` — remains unauthenticated internal-only (correct for actions)
- Prompt name allowlist / educator-only gating — residual; free authed users can still read all prompts
- No switch of Next routes to admin key or internal HTTP
- `renderPrompt` pure helper — no auth surface

## Residual risks

- Any **authenticated** free user can still read any prompt by name (S2-B005 residual; acceptable for now).
- Prompt name enumeration still possible for authed clients (no allowlist).

## Verification

- Unauthed `query coursePrompts:getPrompt` → throws `UNAUTHORIZED` / Not authenticated
- Authed Next API route with Clerk JWT → still returns prompt doc
- `rg 'api\.coursePrompts\.getPrompt'` → only under `src/app/api/**` (authed)
- `rg 'getPromptInternal'` → only Convex internal action paths
