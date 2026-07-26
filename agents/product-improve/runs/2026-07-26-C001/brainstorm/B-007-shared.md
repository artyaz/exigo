# B-007 — Shared Code & Lib Utilities (PA7)

## Subagent meta
- cycle_id: cycle-001
- subagent_id: B-007-shared
- area: PA7
- completed_at: 2026-07-26T12:00:00Z

## Files reviewed
| File | Lines | Imports | Runtime |
|------|-------|---------|---------|
| shared/courseConfig.ts | 27 | none | pure |
| shared/courseTopicRequests.ts | 115 | none | pure |
| shared/currentModuleInsertion.ts | 130 | none | pure |
| shared/hashId.ts | 11 | none | pure |
| shared/planConfig.ts | 120 | none | pure |
| shared/posthogAiObservability.ts | 192 | none (uses global fetch/process.env) | pure |
| shared/subscriptionStatuses.ts | 10 | none | pure |
| src/lib/sse.ts | 63 | none | server (TextEncoder) |
| src/lib/sseClient.ts | 94 | none | pure (browser+server) |
| src/lib/lessonCheckpoints.ts | 310 | none | pure |
| src/lib/bulkImportParser.ts | 126 | none | pure |
| src/lib/otlpLogger.ts | 155 | server-only, @opentelemetry/* | Next.js server |
| src/lib/posthog-server.ts | 30 | server-only, posthog-node | Next.js server |

## Ideas

### I-001-043: Delete dead `sseNamedEvent` export from src/lib/sse.ts
- Description: `sseNamedEvent` (src/lib/sse.ts:28) is not imported by any product route or component. The only references are its own test (src/lib/sse.test.ts:8,32) and agent audit docs. The comment at line 9 already says "remains for any external/legacy callers" but none exist. Removing the function, its test case, and the residual comment shrinks the SSE surface to the actual majority dialect only.
- North-star improvement: Shorter, clearer SSE module with zero ambiguity about which dialect is canonical.
- Riskiest assumption: No untracked consumer (e.g. a playbook or external integration) relies on named-event framing.
- Warrant: Grep across the entire repo shows zero product imports; the tutor route migrated to `sseData` in P11-B. The function is pure dead weight that misleads future contributors into thinking named events are still supported.
- Effort: S

### I-001-044: Remove unused `buildInsertTopicRequestContent` or wire it to the UI
- Description: `buildInsertTopicRequestContent` (shared/courseTopicRequests.ts:71) is exported but only referenced in the test file. The sole product consumer of this module (convex/courseAi.ts:15-17) imports only `parseInsertTopicRequestContent` and `isRequestedTopicCovered`. Either the UI builds topic-request strings via a different path (making this dead code), or the UI should be using it and isn't (a latent bug). Resolving the ambiguity removes a misleading public API.
- North-star improvement: Consistent — every exported symbol has a verifiable consumer, reducing cognitive load.
- Riskiest assumption: The UI may construct the INSERT_TOPIC_REQUEST_PREFIX string inline, making the builder redundant rather than missing.
- Warrant: A builder with zero product callers violates "delete > move > rewrite". If the UI does inline construction, the builder is dead; if it doesn't, the prefix constant is duplicated implicitly.
- Effort: S

### I-001-045: Tighten `getDeepDiveLimitForTier` parameter type from `string` to `PlanTier`
- Description: `getDeepDiveLimitForTier` (shared/planConfig.ts:60) accepts `string` and performs a runtime `in` check, unlike every other tier function in the file which accepts `PlanTier`. This forces callers to handle an implicit "unknown tier → free" fallback that the type system cannot audit. Changing the signature to `PlanTier` (callers already resolve tier before calling) eliminates the defensive branch and aligns with `getLimitsForTier` directly above.
- North-star improvement: Clearer — the type signature communicates the contract without reading the body.
- Riskiest assumption: A caller may genuinely pass an unresolved string (e.g. from a DB row) and rely on the silent fallback.
- Warrant: The only re-export is convex/planLimits.ts:16 which wraps it; callers of that wrapper already have a resolved tier. The `string` signature is a leftover from before PlanTier existed.
- Effort: S

### I-001-046: Normalize filename casing — rename `posthog-server.ts` to `posthogServer.ts`
- Description: All shared/ files use camelCase (`courseConfig.ts`, `hashId.ts`). In src/lib/, 5 of 6 files use camelCase (`sseClient.ts`, `otlpLogger.ts`, `lessonCheckpoints.ts`, `bulkImportParser.ts`) but `posthog-server.ts` uses kebab-case. Renaming to `posthogServer.ts` makes the entire utility layer consistently camelCase, reducing the "which convention?" tax when creating new utilities.
- North-star improvement: Consistent — one naming rule across shared/ and src/lib/ with zero exceptions.
- Riskiest assumption: An external tool or deployment script references the kebab-case filename literally.
- Warrant: Only 2 product files import it (src/lib/convexClientAuth.ts:9, instrumentation.ts:63 dynamic import). The rename is a 3-line diff plus tsconfig path resolution.
- Effort: S

### I-001-047: Relocate `lessonCheckpoints.ts` and `bulkImportParser.ts` to shared/ (or document why not)
- Description: Both src/lib/lessonCheckpoints.ts (310 lines) and src/lib/bulkImportParser.ts (126 lines) are import-free pure modules — identical in runtime character to shared/ files. They are currently only consumed by Next.js components, but Convex course-lesson logic (convex/courseLessons.ts) could benefit from the same checkpoint parsing. Moving them to shared/ (or adding a one-line comment explaining the intentional Next-only scope) makes the cross-runtime boundary explicit.
- North-star improvement: Readable — the directory itself communicates "safe to import anywhere" vs "Next-only".
- Riskiest assumption: Future Convex code may never need these, making the move premature and adding path-length noise.
- Warrant: The Exigo convention states "Cross-runtime pure code in shared/". These files satisfy the criterion today; their placement in src/lib/ is an accident of creation order, not a runtime constraint.
- Effort: M

### I-001-048: Collapse `DEEP_DIVE_LIMITS_BY_TIER` into a derived accessor
- Description: `DEEP_DIVE_LIMITS_BY_TIER` (shared/planConfig.ts:50-54) is a hand-maintained Record that mirrors `LIMITS_BY_TIER.*.deepDiveLimit`. Although the comment says "derived from LIMITS_BY_TIER so callers cannot drift", the object literal is still a separate allocation that a future edit could desync. Replacing it with a function `getDeepDiveLimits()` that builds the record on call (or a `satisfies` assertion) makes drift structurally impossible. Currently only convex/planLimits.ts:3 imports it.
- North-star improvement: Correct — eliminates the last manual mirror of LIMITS_BY_TIER data.
- Riskiest assumption: Callers may depend on referential stability of the exported const (e.g. passing it as a prop).
- Warrant: The comment already acknowledges the derivation intent; making it structural is a one-line change (Object.fromEntries + map) with one consumer to verify.
- Effort: S

### I-001-049: Extract a shared `normalizeForComparison` utility to dedupe string-normalization helpers
- Description: Three private normalization functions exist across shared/: `normalizeWhitespace` (courseTopicRequests.ts:8), `normalizeComparisonValue` (courseTopicRequests.ts:12), and `normalizeLessonTitle` (currentModuleInsertion.ts:21). All perform overlapping lower/trim/collapse operations with slight variations. Extracting a single parameterized `normalizeForComparison(value, { alphanumOnly?: boolean })` into a small shared/text.ts reduces repetition and ensures future normalization changes propagate uniformly.
- North-star improvement: Shorter — one well-tested normalization primitive instead of three near-identical private functions.
- Riskiest assumption: The subtle differences (e.g. `normalizeComparisonValue` strips non-alphanumerics while `normalizeLessonTitle` preserves them) are intentional and unifying them would break matching semantics.
- Warrant: All three follow the same pattern (lowercase → regex replace → trim). A parameterized utility with two call-site configs preserves behavior while eliminating copy-paste drift risk.
- Effort: M

## Patterns observed
1. **shared/ purity is excellent** — zero imports in all 7 source files; only global `fetch`, `process.env`, and `crypto` are used (all available in both Convex and Next.js runtimes).
2. **SSE separation is clean** — sse.ts = server framing (encode), sseClient.ts = client parsing (decode). No overlap in responsibility. The only blemish is the dead `sseNamedEvent`.
3. **planConfig.ts is a well-enforced SSOT** — 18 import sites across Convex and Next.js all read from LIMITS_BY_TIER. Marketing perks derive from the same numbers. No drift detected.
4. **posthogAiObservability.ts is the correct cross-runtime path** — 10 consumers (6 Next.js routes + 4 Convex actions). The posthog-server.ts comment explicitly delineates the boundary.
5. **src/lib/ pure modules blur the shared/ boundary** — lessonCheckpoints, bulkImportParser, and sseClient are import-free pure code that could live in shared/ per convention.
6. **Naming is 95% consistent** — only posthog-server.ts breaks the camelCase pattern.

## Recommended brainstorm clusters
| Cluster | Ideas | Theme |
|---------|-------|-------|
| Dead-code hygiene | I-001-043, I-001-044 | Remove exports with zero product consumers |
| Type-safety tightening | I-001-045, I-001-048 | Make illegal states unrepresentable in planConfig |
| Convention enforcement | I-001-046, I-001-047 | Align file placement and naming with stated conventions |
| Micro-deduplication | I-001-049 | Collapse near-identical private helpers |
