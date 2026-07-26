# Decision Package — DP-003

**TRIGGER:** Wave α findings I-001-008, I-001-003, I-001-026, I-001-013, I-001-012, I-001-018, I-001-049 — seven independent observations converging on one structural debt: plan-limit enforcement, ownership checks, and small normalization utilities are hand-rolled at every call site instead of flowing through shared helpers. The limit numbers are already centralized (`shared/planConfig.ts` `LIMITS_BY_TIER`), but the *enforcement* of those numbers is not.

**NORTH_STAR_HURT:** (1) **Correctness/consistency:** the "limit reached" error message has already drifted — `createEmptyTest` reports `"You have created ${count} tests this month. Your current plan limit is ${maxAllowed}"` while `create`/`createWithQuestions` report `"You can only create ${maxAllowed} tests per month"`. When marketing or legal asks "what do we tell users at the cap?", there is no single answer. (2) **Readable/short:** ~25 lines of identical prelude (auth → feature-gate → fetch space → ownership → count → compare → throw) are copy-pasted across three test mutations, and the "fetch limit → count → throw" shape is re-rolled in four more modules. (3) **Wasted work:** `/api/tests/generate` enforces the monthly test cap, then calls `createEmptyTest` which enforces it *again* — two plan lookups + two count queries per generation. (4) **Convention vacuum:** `courseAuth.ts` and `spaceAccess.ts` prove the team *intends* single tenancy/ownership gates, but adoption is partial, so every new mutation re-rolls ownership and risks a drift bug.

**LOCATION:** `convex/tests.ts`, `convex/spaces.ts`, `convex/knowledgePieces.ts`, `convex/deepDives.ts`, `convex/knowledgeNodes.ts`, `convex/courseAuth.ts`, `convex/courseLessonMessages.ts`, `convex/courseAi.ts`, `convex/courseOrchestrator.ts`, `convex/courseModules.ts`, `convex/courseTutor.ts`, `convex/courses.ts`, `convex/authDecorators.ts`, `convex/planLimits.ts`, `src/app/api/tests/generate/route.ts`, `src/app/api/tests/feels-hard/route.ts`, `src/app/api/tests/validate/route.ts`, `shared/courseTopicRequests.ts`, `shared/currentModuleInsertion.ts`

**SYMPTOM:** Three enforcement idioms coexist for the same conceptual operation ("is this user allowed to create one more of X?"): a feature-gate (`limit === 0 → throw "no access"`), an ownership prelude (`fetch space/course → compare userId`), and a quota check (`count → compare → throw "limit reached"`). Each is written inline, with divergent wording and divergent query strategies (`take(limit)` vs full `collect()` vs `by_user` index range). Meanwhile two byte-identical helpers (`resolveTargetPiece`) and three overlapping string normalizers live in separate files under different names.

**EVIDENCE:**

| ID | File:Lines | Observation |
|----|-----------|-------------|
| I-001-008 | `tests.ts:94-131, 140-175, 298-345` | `createEmptyTest`, `create`, `createWithQuestions` each repeat the same ~25-line prelude: `getAuthedContext` → `maxTestsPerMonth === 0` gate → `ctx.db.get(spaceId)` → `space.userId !== auth.userId` → `countForUserThisMonthInternal` → `count >= maxAllowed` throw. **Message drift confirmed:** line 117 vs lines 162/320 use different copy for the same cap. |
| I-001-003 | `courseLessonMessages.ts:10-24`, `courseAi.ts:548,617,729`, `courseOrchestrator.ts:133`, `courseModules.ts:53,69`, `courseTutor.ts:101-106`, `courses.ts:49,86` | The `lesson → course → userId` (or `course.userId !== userId`) ownership check is open-coded at 8+ sites. `courseAuth.ts:9-22` exports `requireOwnedCourseForAction` but it is **ActionCtx-only** (uses `ctx.runQuery(internal.courses.getInternal)`), so query/mutation handlers that use `ctx.db.get` cannot reuse it and re-roll the check. |
| I-001-026 | `spaces.ts:54-64`, `tests.ts:113-119`, `knowledgePieces.ts:49-56 & 113-123`, `deepDives.ts:50-65` | Four modules hand-roll "read limit → count → throw" with **different wording and different counting strategies**: `spaces` uses `.take(serverLimit)`; `tests` sums per-space monthly counts; `knowledgePieces` uses `existing.length + incoming`; `deepDives` uses a `by_user` `_creationTime` range + `.take`. Cap messages: "You can only have N spaces" / "You can only create N tests per month" / "You can only have N knowledge pieces per space" / "Bulk import would exceed" / "You can only generate N Deep Dive notes per month". |
| I-001-013 | `src/app/api/tests/generate/route.ts:287-309` → `tests.ts:94-119` | The route queries `planLimits.getPlan` for `maxTestsPerMonth`, returns 403 if `=== 0`, then queries `tests.countForUserThisMonth` and returns 403 if over cap — and *then* invokes `createEmptyTest`, which re-runs the exact same gate + count. Double enforcement = 1 extra plan lookup + 1 extra count query per generation, plus two sources of truth for the cap message. |
| I-001-012 | `feels-hard/route.ts:35-46` vs `validate/route.ts:43-54` | `resolveTargetPiece(knowledgePieceId, testKnowledgePieceId)` and `resolveTargetPieceId(explicitKnowledgePieceId, testKnowledgePieceId)` are **logic-identical** (return explicit ?? test ?? null), differing only in parameter names. |
| I-001-018 | `knowledgeNodes.ts:38-44` vs `135-141` | `create` and `createInternal` both fetch the knowledge piece, throw `"Knowledge piece not found"`, and throw `"Knowledge piece does not belong to this space"` on `spaceId` mismatch — verbatim duplicate validation. |
| I-001-049 | `courseTopicRequests.ts:8,12` vs `currentModuleInsertion.ts:21` | Three private normalizers overlap: `normalizeWhitespace` = `replace(/\s+/g," ").trim()`; `normalizeComparisonValue` = `toLowerCase().replace(/[^a-z0-9]+/g," ").trim()`; `normalizeLessonTitle` = `toLowerCase().replace(/\s+/g," ").trim()`. All trim + collapse whitespace; two also lowercase. Genuine overlap, but **semantics differ subtly** (the `[^a-z0-9]+` class strips punctuation that `\s+` keeps) — a naive merge would change matching behavior. |

**QUESTION:** Should we extract shared enforcement helpers — a feature-gate primitive, a quota-assertion primitive, and ownership guards — so every mutation enforces limits with one wording and one query path? And specifically: **one generic helper vs per-domain helpers, and where does it live** (`planLimits.ts`? a new `limitEnforcement.ts`/`limitHelpers.ts`? `authDecorators.ts`?)?

---

## Recommendation

- **Approach name:** Shared enforcement *primitives* + per-domain *counters* (hybrid), housed in a new tiny `convex/limitEnforcement.ts`, with ownership guards consolidated into the existing `spaceAccess.ts` / `courseAuth.ts`.

- **One-paragraph rationale:** The duplication splits cleanly into two layers. The **decision layer** — "is this feature enabled?" (`limit === 0`) and "are we under the cap?" (`UNLIMITED` sentinel + `count >= limit` + a consistently-worded throw) — is *identical* across every module and is exactly what has drifted; it should be one pure, unit-testable function pair with the copy owned in a single place. The **counting layer** — *how* you tally tests-this-month-across-owned-spaces vs knowledge-pieces-in-this-space vs spaces-by-user vs deep-dives-by-user-index — is *genuinely domain-specific* (different indexes, different scopes, different windows), and forcing it through one generic `count(thunk)` abstraction would add indirection without removing real duplication. So: centralize the primitives, keep the counters in their domains, and have each domain counter call the shared assertion. This is the same philosophy the codebase already adopted for tenancy (`spaceAccess.ts` = pure SSOT) and course ownership (`courseAuth.ts`); we are completing that intent for limits. It directly fixes the message drift (I-001-008/026), removes the double-enforcement query waste by giving the route a single authoritative check to trust (I-001-013), and gives new mutations a one-line path instead of 25 lines to copy.

- **Why not alternatives:** A single god-helper `enforceLimit(resource, ...)` that also does the counting (Approach B) looks DRYer on paper but must accept a query thunk + scope + window + resource-noun for every caller; the resulting signature is harder to read than the 6 lines it replaces, and it couples `planLimits` to every domain's indexes. Doing nothing / lint-only (Approach C) leaves the user-facing message drift and the double query in place. Putting everything in `authDecorators.ts` (Approach D) overloads a module whose name and current exports are about *identity/access-level*, not *quota accounting* — and `authDecorators` is imported everywhere, so growing it raises blast radius.

### Approaches considered

| ID | Name | Pros | Cons | North-star score | Effort |
|----|------|------|------|-----------------|--------|
| A | **Shared primitives + per-domain counters** (selected) — new `convex/limitEnforcement.ts` exporting pure `requireFeatureEnabled(limit, feature)` + `assertWithinLimit({limit,count,noun,scope})`; domains keep their counters but call the primitive; ownership guards added to `spaceAccess.ts` (`requireOwnedSpace`) and `courseAuth.ts` (`requireOwnedCourse` for `QueryCtx`/`MutationCtx`). Dedup `resolveTargetPiece` and normalizers into `shared/`. | Fixes message drift at the source; removes double-enforcement; mirrors existing `spaceAccess`/`courseAuth` convention; primitives are trivially unit-testable; surgical, file-by-file adoption. | Two new small modules; requires touching ~8 files to reap full benefit (but each touch is a deletion). | 9/10 | M (2–3 days) |
| B | **One generic `enforceLimit` helper** that also performs the count via a passed query thunk + config object. | Maximum theoretical DRY; one import. | Over-abstraction: signature must encode scope/window/index per domain; harder to read than the code it replaces; couples limit module to every domain's DB indexes; counting strategies (`take` vs range vs sum) don't unify cleanly. | 5/10 | M (2–3 days) |
| C | **Lint rule + leave code as-is** — forbid inline `count >= limit` throws, require a comment. | Zero runtime risk. | Doesn't fix drift or double-enforcement; lint can't enforce *wording*; convention-only enforcement is weak (same failure mode that produced this debt). | 3/10 | S (0.5 day) |
| D | **Extend `authDecorators.ts`** with the limit primitives alongside `requireMinAccessLevel`. | No new file; lives next to existing gates. | Overloads an identity/access module with quota accounting; `authDecorators` is imported by ~every module so growth raises blast radius; muddies the "auth = who are you" vs "limits = what may you do" boundary that `planLimits.ts` already implies. | 6/10 | S–M (1–2 days) |

**Selected: Approach A.**

### Minimal implementation sketch

**Files:**
- `convex/limitEnforcement.ts` *(new)* — pure primitives, no DB import.
- `convex/limitEnforcement.test.ts` — **rename existing** `convex/limitEnforcement.test.ts` (which actually tests `subscriptionService`) to `convex/subscriptionService.test.ts`, then add the new primitives' tests under the freed name. *(See research note — name collision.)*
- `convex/tests.ts` — replace the 3 inline preludes with primitives + a local `assertCanCreateTest(ctx, auth)`.
- `convex/spaces.ts`, `convex/knowledgePieces.ts`, `convex/deepDives.ts` — swap inline `count >= limit` throws for `assertWithinLimit`.
- `convex/spaceAccess.ts` — add `requireOwnedSpace(ctx, spaceId, userId)` (DB-fetching write guard) alongside the existing pure `canWriteSpace`.
- `convex/courseAuth.ts` — add `requireOwnedCourse(ctx: QueryCtx|MutationCtx, courseId, userId)` using `ctx.db.get`, complementing the existing `...ForAction`.
- `convex/knowledgeNodes.ts` — extract `assertPieceBelongsToSpace(ctx, pieceId, spaceId)`; call from both `create` and `createInternal`.
- `src/app/api/tests/generate/route.ts` — drop the inline cap re-check; trust `createEmptyTest` (or call one shared server query) so enforcement happens once.
- `src/app/api/tests/_lib/resolveTargetPiece.ts` *(new, or co-locate in an existing shared api lib)* — single `resolveTargetPiece`; import from `feels-hard` + `validate`.
- `shared/textNormalize.ts` *(new)* — `collapseWhitespace`, `normalizeForComparison`, `normalizeTitle` with the three *distinct* semantics preserved; `courseTopicRequests.ts` + `currentModuleInsertion.ts` import from it.

**Steps:**

1. **Add the primitives (no callers yet).** Create `convex/limitEnforcement.ts`:
   ```ts
   import { UNLIMITED_LIMIT } from "../shared/planConfig";
   /** Throw the canonical "feature not on your plan" error when a limit is 0. */
   export function requireFeatureEnabled(limit: number, featureNoun: string): void {
     if (limit === 0) {
       throw new Error(
         `You don't have access to ${featureNoun} on your current plan. Please upgrade to continue.`,
       );
     }
   }
   /** Throw the canonical "limit reached" error when count meets/exceeds a finite cap. */
   export function assertWithinLimit(opts: {
     limit: number; count: number; noun: string; scope?: string;
   }): void {
     const { limit, count, noun, scope } = opts;
     if (limit !== UNLIMITED_LIMIT && count >= limit) {
       throw new Error(
         `Limit reached: You can only have ${limit} ${noun}${scope ? ` ${scope}` : ""} on your current plan.`,
       );
     }
   }
   ```
   Pure, no `ctx`, fully unit-testable. Wording is now owned in exactly one place.

2. **Migrate the test mutations (biggest win).** In `tests.ts`, extract a local helper that composes the primitives with the domain counter:
   ```ts
   async function assertCanCreateTest(ctx, auth) {
     requireFeatureEnabled(auth.limits.maxTestsPerMonth, "test generation");
     const count = await countForUserThisMonthInternal(ctx, auth.userId);
     assertWithinLimit({ limit: auth.limits.maxTestsPerMonth, count, noun: "tests", scope: "per month" });
   }
   ```
   Then `createEmptyTest`/`create`/`createWithQuestions` each call `getAuthedContext` → `requireOwnedSpace(ctx, args.spaceId, auth.userId)` → `assertCanCreateTest(...)`. ~25 lines × 3 → ~3 lines × 3. Message drift gone.

3. **Migrate the other quota sites.** `spaces.ts`, `knowledgePieces.ts` (both `add` and `bulkImport`), `deepDives.ts`: keep their existing counters (they differ for good reason) but replace the inline `if (... >= limit) throw` with `assertWithinLimit(...)`. `requireFeatureEnabled` covers the `deepDives` `maxDives === 0` gate.

4. **Consolidate ownership guards.** Add `requireOwnedSpace` to `spaceAccess.ts` and `requireOwnedCourse` (DB variant) to `courseAuth.ts`. Migrate the 8+ open-coded `course.userId !== userId` / `space.userId !== auth.userId` sites to call them. Keep the *pure* `canReadSpace`/`canWriteSpace` for read queries that soft-fail (return `[]`/`null`) — the new guards are the *throwing* write-path complements (aligns with DP-004).

5. **Kill the double enforcement.** In `generate/route.ts`, remove the inline `getPlan` + `countForUserThisMonth` 403 block (lines 287-309) and rely on `createEmptyTest`'s now-single authoritative check, translating a thrown `PLAN_LIMIT`/limit error into the route's 403 JSON. (If the route needs the cap *before* doing AI work to fail fast, keep a single lightweight `tests.assertCanCreate`-style query and have `createEmptyTest` accept a `skipLimitCheck` internal flag — but prefer one check.)

6. **Dedup the small helpers.** Extract `resolveTargetPiece` to a shared api lib; both routes import it. Create `shared/textNormalize.ts` with three clearly-named functions preserving the three semantics; update `courseTopicRequests.ts` + `currentModuleInsertion.ts`. Extract `assertPieceBelongsToSpace` in `knowledgeNodes.ts`.

**What NOT to do:**
- Do **NOT** unify the *counters* into one generic function. `take(limit)` (spaces/deepDives), monthly-sum-across-owned-spaces (tests), and `existing + incoming` (knowledgePieces bulk) are different for real reasons; a thunk-based generic helper is the over-abstraction trap (Approach B).
- Do **NOT** merge the three normalizers into one. `normalizeComparisonValue` strips punctuation (`[^a-z0-9]+`) while `normalizeLessonTitle` only collapses whitespace (`\s+`); collapsing them changes lesson-matching and topic-dedup behavior. Centralize the *file*, keep the *functions* distinct.
- Do **NOT** change the public Convex API surface (args/return shapes) of any mutation/query — cycle scope forbids it. These are internal-handler refactors only.
- Do **NOT** create `convex/limitEnforcement.ts` without first renaming the existing `convex/limitEnforcement.test.ts` (it tests `subscriptionService`, not enforcement) — otherwise the new module's tests collide with a misnamed suite.
- Do **NOT** make `assertWithinLimit`/`requireFeatureEnabled` throw `ConvexError` with a plan code unless the routes that catch them are updated to read that code; today the mutations throw plain `Error` and the generate route translates by message. Keep plain `Error` for parity, or coordinate the code change with step 5.
- Do **NOT** adopt partially and leave `tests.ts` drift in place — the whole north-star value is the single wording; a half-migration is worse than none.

### Skills applied

- **Convention extraction:** `spaceAccess.ts` (pure tenancy SSOT, comment cites F-W7-004/P10-A) and `courseAuth.ts` (single ownership gate) are the codebase's own answer to "where do shared guards live?". Approach A completes that pattern for limits rather than inventing a new one. `questions.ts` remains the gold-standard consistent consumer (per DP-004).
- **Blast-radius / drift verification:** Read all three `tests.ts` mutations line-by-line and confirmed the cap message has *already* diverged (line 117 vs 162/320) — this is latent-correctness debt, not hypothetical. Confirmed `generate/route.ts:287-309` re-checks what `createEmptyTest` re-checks (double plan lookup + double count).
- **Semantic diff before dedup:** Compared the three normalizers character-by-character and flagged that `normalizeComparisonValue` ≠ `normalizeLessonTitle` (punctuation stripping), preventing a behavior-changing "obvious" merge.
- **Test-convention check:** Read `limitEnforcement.test.ts` + `planLimits.test.ts` to confirm the team writes honest pure-unit tests against real prod helpers (no shadow handlers) — the new primitives slot straight into that style.

### Research notes

- `shared/planConfig.ts` is already the SSOT for the *numbers* (`LIMITS_BY_TIER`) and even derives marketing copy from them so UI can't drift from enforcement. The missing half is the *enforcement wording + comparison*, which is exactly what `limitEnforcement.ts` supplies. This DP is the natural completion of the SSOT idea the team already started.
- **Name collision:** the existing `convex/limitEnforcement.test.ts` tests `subscriptionService` (access levels, slugs, tier boundaries), not enforcement. Rename it to `subscriptionService.test.ts` first so the new module can own the `limitEnforcement` name cleanly. Alternatively name the new module `planLimitEnforcement.ts` to avoid touching the test file — but that's a longer, uglier name and the rename is a 1-line surgical move.
- `courseAuth.ts`'s `requireOwnedCourseForAction` exists *only* for `ActionCtx` (it must use `ctx.runQuery(internal.courses.getInternal)` because actions can't touch `ctx.db`). That's why the 8 query/mutation sites couldn't reuse it and re-rolled the check. Adding a `QueryCtx|MutationCtx` sibling that uses `ctx.db.get` closes the gap without disturbing the action path.
- Counting-strategy inventory (why counters stay per-domain): `spaces.create` → `.take(serverLimit)` over `by_user`; `tests` → sum of per-space monthly counts via `countForUserThisMonthInternal` (must exclude `default_user` demo spaces per `spaceAccess` comment); `knowledgePieces` → `existing.length + incoming` within one space (per-space, not per-month); `deepDives` → `by_user` index with `_creationTime >= startOfMonth` + `.take`. Four genuinely different shapes.
- `deepDives.ts:7-10` and `tests.ts:39-42` both define a `getStartOfMonth{UTC,Ms}` helper with identical bodies — a minor extra dedup candidate (move to `limitEnforcement.ts` or a `shared/time.ts`) worth folding into step 3.
- Relationship to DP-004 (auth unification): DP-004 owns *identity + tenancy read-path* (`getAuthenticatedUserId`, `canReadSpace`, middleware). DP-003 owns *quota enforcement + write-path ownership guards*. They are complementary and should be implemented together or DP-004-first; the `requireOwnedSpace`/`requireOwnedCourse` throwing guards are the write-side counterpart to DP-004's read-side soft-fails.

### Residual risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Changing the cap error *wording* breaks a client that string-matches the old message | Low–Med | Grep clients for `"Limit reached"` / `"You can only"` before shipping; prefer returning a stable error `code` (coordinate with DP-004) rather than relying on message text. |
| Removing double-enforcement in `generate/route.ts` lets a user start AI work then fail at insert, wasting an AI call | Medium | If fail-fast matters, keep *one* authoritative pre-check (a shared `tests.assertCanCreate` query) and add an internal `skipLimitCheck` to `createEmptyTest` — but ensure only one path enforces. |
| Renaming `limitEnforcement.test.ts` → `subscriptionService.test.ts` breaks CI test discovery / coverage config | Low | Verify `vitest.config.ts` uses glob discovery (it does — `*.test.ts`); run the suite after rename. |
| Partial adoption leaves two wordings coexisting (worse than one) | Medium | Land the `tests.ts` migration (step 2) in the same PR as the primitives (step 1); treat "single wording" as the merge criterion. |
| `requireOwnedSpace` throwing guard accidentally used in a *read* query, turning graceful empty states into UNAUTHORIZED crashes | Medium | Name it `requireOwnedSpace` (throw) vs keep `canReadSpace` (pure) distinct; document that throwing guards are write-path only (mirrors DP-004 guidance). |
| Normalizer centralization subtly changes topic-dedup or lesson-match behavior | Low | Keep three distinct functions with identical bodies to today; add unit tests capturing current behavior before swapping imports. |

### Suggested finding severity

| Finding | Severity | Rationale |
|---------|----------|-----------|
| I-001-008 | **High** | Three-way copy of the enforcement prelude with *already-drifted* user-facing cap messages; direct consistency + correctness debt in a revenue-relevant path (test generation). |
| I-001-003 | **High** | 8+ open-coded ownership checks; a single missed `course.userId` compare is an authorization bug. The intended guard (`courseAuth.ts`) exists but is unusable for queries/mutations. |
| I-001-026 | **High** | Same "fetch limit → count → throw" re-rolled in 4 modules with 5 different wordings and 4 different counting strategies — the clearest case for a shared assertion primitive. |
| I-001-013 | Medium | Double enforcement wastes a plan lookup + count query per generation and creates two sources of truth for the cap; a performance/consistency issue, not a correctness bug (both checks agree today). |
| I-001-012 | Low | Two byte-identical `resolveTargetPiece` helpers; trivial dedup, low blast radius, pure readability win. |
| I-001-018 | Medium | Duplicated piece→space validation in `create`/`createInternal`; small but a real drift risk on a write path. |
| I-001-049 | Low | Three overlapping normalizers; readability/consistency win, but requires care to preserve distinct semantics — low urgency, low risk if done correctly. |
