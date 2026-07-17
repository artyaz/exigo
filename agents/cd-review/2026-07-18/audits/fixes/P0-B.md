# Fix Pack P0-B — questions auth (F-S3-001)

**Status:** applied  
**Brain:** `audits/brainstorm/S3-B001.md` → Approach A  
**Finding:** F-S3-001 — `questions.ts` public surface unauthenticated / client-`userId` IDOR

## What changed

### `convex/questions.ts`
- **Identity-first:** mutations use `getAuthenticatedUserId` (throws `UNAUTHORIZED` ConvexError when unauthenticated).
- **Removed `args.userId`** from `create` and `updateFeedback`.
- **Authorize via test → space ownership** (shared helpers: `loadTestSpace`, `canAccessTest` / `canAccessSpace`, `requireTestAccess`).
- **Reads soft-fail:** unauthenticated or non-owner → `null` (`get`) or `[]` (`getForTest`, `getForSpace`, `getIncorrectForTopic`) — matches `knowledgePieces.getForSpace` / `spaces` list patterns.
- **Writes hard-fail:** missing resources throw; ownership failures throw `"Unauthorized access to this test"`.
- **`default_user`:** left as-is on the ownership check (already present on create/updateFeedback; not redesigned).

### Call sites (drop `userId` arg only)
- `src/app/api/tests/generate/route.ts` — `api.questions.create`
- `src/app/api/tests/validate/route.ts` — `api.questions.updateFeedback`

### Unchanged callers (query args unchanged; auth now server-side)
- Client: `useQuery(api.questions.getForTest|getForSpace)` (already skip when no `userId`)
- `src/app/api/tests/feels-hard/route.ts` — `api.questions.get`
- generate route queries: `getForTest`, `getIncorrectForTopic`
- validate route query: `get`

## What we did not do
- Plan / subscription gates
- Schema changes
- `default_user` policy redesign (S3-B005)
- Converting functions to `internal*`

## Verify
- [ ] Unauthenticated `getForTest` / `get` → `[]` / `null`
- [ ] Non-owner cannot read another user’s answers
- [ ] Owner can `create` / `updateFeedback` via authenticated Convex client (generate/validate routes)
- [ ] Attacker-supplied former `userId` arg is impossible (arg removed)
- [ ] `npm run check` / tests green after pack merge
