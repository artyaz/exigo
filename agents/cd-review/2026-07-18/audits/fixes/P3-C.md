# Fix Pack P3-C — Collapse Next PostHog clients

**Findings:** S10-B002 / PostHog client sprawl (P1)  
**Brain:** S10-B002 approach A (sole Next `posthog-node` via `getPostHogServer`; keep shared fetch for Convex)  
**Status:** done

## Summary

Next had three `posthog-node` shapes: dead `getPostHogServer()` (threw without key), a private singleton in `convexClientAuth`, and a one-shot client + `shutdown` in root `instrumentation.ts`. Collapsed product exception capture onto one soft-failing singleton in `src/lib/posthog-server.ts`. Left `shared/posthogAiObservability.ts` as the only fetch-based AI event path (Convex-safe); no Node imports into `shared/`.

## Per-finding

| ID | Sev | Status | What changed |
|----|-----|--------|--------------|
| S10-B002 | P1 | **done** | Single Next `posthog-node` entrypoint; private convex client deleted; instrumentation reuses singleton + `flush` (not `shutdown`); shared AI module boundary comment only |

## Call sites

| Path | Before | After |
|------|--------|-------|
| `src/lib/posthog-server.ts` | Threw if no key; unused export | Returns `PostHog \| null`; sole Next singleton + `server-only` |
| `src/lib/convexClientAuth.ts` | `getConvexPosthogClient` / `ensureConvexPosthogClient` private singleton | `getPostHogServer()` sync capture |
| `instrumentation.ts` `onRequestError` | One-shot `new PostHog` + `shutdown(2000)` | Dynamic import `getPostHogServer` + `flush()` |
| `shared/posthogAiObservability.ts` | Undocumented dual-purpose risk | One-line boundary comment; fetch transport unchanged |

## Files touched

| File | Change |
|------|--------|
| `src/lib/posthog-server.ts` | Soft-fail null; docs; `server-only` |
| `src/lib/convexClientAuth.ts` | Drop private PostHog singleton; import shared Next helper |
| `instrumentation.ts` | Use singleton; flush not shutdown |
| `shared/posthogAiObservability.ts` | Boundary comment only |
| `audits/fixes/P3-C.md` | this writeup |

## Explicitly not changed

- `shared/posthogAiObservability.ts` capture/fetch logic and `NEXT_PUBLIC_POSTHOG_*` reads (Convex needs them)
- Client `posthog-js` (`instrumentation-client.ts`, error boundaries, identify)
- OTLP logger / logs pipeline
- Convex AI action imports of shared observability

## Residual risks

- Soft-fail null when key missing is intentional; misconfigured prod still silently no-ops product exceptions (same as prior convexClientAuth path).
- Shared AI module still needs `NEXT_PUBLIC_POSTHOG_*` on Convex deployment for `$ai_generation`.
- Instrumentation no longer shuts down the client after each error (correct for a singleton); relies on `flushAt: 1` + explicit `flush()`.

## Verification

- `rg 'getConvexPosthogClient|ensureConvexPosthogClient' src` → empty
- `rg 'new PostHog' instrumentation.ts src/lib` → only `posthog-server.ts`
- `npx tsc --noEmit` → clean
