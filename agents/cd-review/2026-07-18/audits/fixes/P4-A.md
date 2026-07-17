# Fix pack P4-A — Paddle webhook trust

**Findings:** S1-B005 (P1 — Webhook trust: deploy-key auth, client-supplied accessLevel, userId mismatch soft-fail)  
**Brain:** Approach A — dedicated webhook secret + recompute accessLevel server-side from planSlug; fail closed on userId mismatch

## What changed

### 1. accessLevel derived from planSlug (not trusted from body)

| Layer | Behavior |
|-------|----------|
| `shared/planConfig.ts` | Added `slugToAccessLevel(slug)` → `tierToAccessLevel(slugToTier(slug))` |
| `convex/http.ts` | Requires `planSlug`; derives accessLevel; if body still sends `accessLevel`, must equal derived or **400** |
| `convex/subscriptionsInternal.ts` | Always stores `slugToAccessLevel(planSlug)`; body `accessLevel` optional and ignored for entitlements |
| `src/app/api/webhooks/paddle/route.ts` | Sends accessLevel from shared mapping (not plans table alone) so Convex equality check passes |

Money path cannot invent Educator without a plan slug that maps to educator via shared rules (`startsWith("educator")` / `"pro"`).

### 2. userId mismatch fail closed

`upsertFromPaddle` previously logged a warn then **patched** entitlements onto the original owner.

Now:
- Mutation returns `{ ok: false, reason: "userId_mismatch" }` without DB write
- HTTP layer returns **409** with JSON error
- Next route propagates **409** to Paddle (no silent success / no Clerk metadata update after conflict)

### 3. Dedicated Next→Convex hop secret

| Env | Role |
|-----|------|
| `PADDLE_CONVEX_WEBHOOK_SECRET` | **Preferred** shared secret for `Authorization: Convex <secret>` on `/paddleWebhook` |
| `CONVEX_DEPLOY_KEY` | Fallback only when dedicated secret unset; logs a warning on both Next and Convex |

Must be set on **both** Next (Vercel/host) and Convex dashboard env for the dedicated path. Documented in `.env.example`.

Auth resolution (both sides):
1. If `PADDLE_CONVEX_WEBHOOK_SECRET` non-empty → use it exclusively
2. Else if `CONVEX_DEPLOY_KEY` non-empty → fallback + warn
3. Else → 500 / throw misconfiguration

Cancel path uses the same auth (no change to cancel args).

## Files touched

| File | Change |
|------|--------|
| `convex/http.ts` | Secret resolve; planSlug required; derive/verify accessLevel; 409 on mismatch |
| `convex/subscriptionsInternal.ts` | Derive accessLevel; fail closed userId mismatch return |
| `src/app/api/webhooks/paddle/route.ts` | Dedicated secret; shared slug mapping; propagate 409 |
| `shared/planConfig.ts` | `slugToAccessLevel` helper |
| `.env.example` | Document `PADDLE_CONVEX_WEBHOOK_SECRET` |
| `audits/fixes/P4-A.md` | This note |

## Residual risks

1. **Next still maps Paddle events** — compromise of Next can still call `/paddleWebhook` with any `userId` + valid secret + planSlug until mutual TLS / Paddle verify moves into Convex (approach C).
2. **Deploy-key fallback** remains until ops sets `PADDLE_CONVEX_WEBHOOK_SECRET` on both sides and rotates away deploy-key dual-use.
3. **Unknown slugs map to free (0)** via `slugToTier` — privilege fail-closed; product still requires known slug at Next (`plans.getBySlug`).
4. **Transfer of paddle sub ownership** not supported — intentional; needs explicit admin path if ever required.

## Ops checklist

1. Generate a high-entropy secret; set `PADDLE_CONVEX_WEBHOOK_SECRET` in:
   - Next runtime env
   - Convex deployment env (`npx convex env set PADDLE_CONVEX_WEBHOOK_SECRET …`)
2. Redeploy both; confirm logs no longer warn about deploy-key fallback.
3. Optionally stop relying on `CONVEX_DEPLOY_KEY` for this hop (keep deploy key for deploy tooling only).

## Tests run

```bash
npx tsc --noEmit
# clean

npm run test -- convex/planLimits.test.ts convex/limitEnforcement.test.ts shared/
# (see session output)
```

No dedicated unit tests for httpAction / webhook route (Node/Convex boundary); trust behavior is structural.

## Follow-ups

1. Ops: set dedicated secret in all environments.
2. Longer-term: Paddle signature verify inside Convex httpAction only (approach C) to remove Next from trust chain.
3. Optional: unit tests for `slugToAccessLevel` parity with `parseSlugToAccessLevel` in subscriptionService.
