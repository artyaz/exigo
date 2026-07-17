# Fix pack P1-D — Kill liar/shadow tests

**Findings:** S1-B004 (liar limit-enforcement tests), S3-B007 (`tests.test.ts` shadow handlers)  
**Brain:** S1-B004 Approach A; S3-B007 Approach A  
**Scope:** test-only. No production metering / mutation logic changed.

## What changed

### `convex/limitEnforcement.test.ts` (rewrite)
- **Deleted** local shadow handlers (`createSpaceHandler`, `addKnowledgePieceHandler`, `createEmptyTestHandler`, `bulkImportHandler`) and the mock ctx that spoofed plan via Clerk `privateMetadata` / client `args.plan`.
- Those handlers never imported production mutations, counted tests **per space** (prod meters **user-month**), and free test limit was never boundary-tested (suite "passed" with 10 rows while free cap is 3).
- **Kept / expanded** pure unit tests of real exports from `subscriptionService`:
  - `parseSlugToAccessLevel`, `isProOrHigher`, `normalizeAccessLevel`
  - `getLimitsForAccessLevel` free / pro / educator boundaries
  - Explicit free `maxTestsPerMonth === 3` boundary (documents the old liar)
  - Slug → limits composition
- Overlaps intentionally with `planLimits.test.ts` on core limit numbers; this file focuses on enforcement-relevant helpers and paid/unlimited sentinel behavior.

### `convex/tests.test.ts` (slash ~700 lines of shadows)
- **Deleted** local shadow suites and integration theater:
  - `createHandler` / `updateStatusHandler` / `getForSpaceHandler` / `getHandler`
  - create / updateStatus / getForSpace / get describe blocks
  - integration scenarios built on those shadows
- Shadow `updateStatusHandler` checked `test.userId` (wrong ownership model; prod uses space ownership). Shadow `createHandler` omitted auth, plan limits, and `questionCount`.
- **Kept** only tests of real production surface:
  - Pure helpers: `sortTestsByCreationDesc`, `countAnsweredQuestions`, `enrichTestForList`
  - Real `listAll` via `_handler` probe + thin ctx stub (auth match, sort, enrich, exclude other users' spaces)

## What did NOT change
- No edits under production metering paths (`convex/tests.ts` create/limit paths, `spaces.ts`, `knowledgePieces.ts`, `subscriptionService.ts` strategies, `shared/planConfig.ts`).
- No new Convex integration harness.

## Tests run
```bash
npm run test -- convex/limitEnforcement.test.ts convex/tests.test.ts
# 2 files, 26 tests, all passed
```

## Risks

| Risk | Notes |
|------|--------|
| Coverage % drop | Expected. Deleted lines were false confidence, not production coverage. |
| Mutation bodies untested | `create` / `updateStatus` / `get` / `getForSpace` still lack honest unit/integration tests. Prefer extracting pure helpers or convex-test later — not shadow rewrites. |
| Duplicate limit number asserts | Slim overlap with `planLimits.test.ts`; acceptable for enforcement-focused file. |

## Follow-ups (out of pack)
1. Extract calendar-month count / limit-check pure helpers from create mutations for real unit tests (S1-B004 optional step B).
2. Optional convex-test harness for full mutation auth + metering.
3. Align any remaining ghost suites elsewhere with the same delete-when-ghost rule.
