# S-002 — Cycle cycle-001 Constraints for Next Cycle

## New constraints (created this cycle)

### C-001-001: Respect the intentional two-path AI architecture
- Type: MUST_RESPECT
- Source idea: DP-001 (AI integration consistency)
- Source verdict: ADVANCE
- Rationale: Convex actions use direct @google/genai (path 2); Next API routes use resolveAiProvider (path 1). Do not collapse them. Fix drift WITHIN each path, not across.

### C-001-002: Delete dead code before abstracting live code
- Type: MUST_RESPECT
- Source idea: DP-002 (dead code removal)
- Source verdict: ADVANCE
- Rationale: 11 confirmed dead items (~600 LOC) should be removed before any new helper extraction. Deleting first reduces the surface area that new abstractions must cover.

### C-001-003: Do not add retry to Convex actions
- Type: MUST_AVOID
- Source idea: DP-005 (streaming resilience)
- Source verdict: ADVANCE
- Rationale: Convex actions run in a different runtime with different rate-limit profiles. The Google SDK handles retries internally. Adding Next-style retry to Convex actions is unnecessary and untestable.

### C-001-004: Land DP-003 and DP-004 together
- Type: MUST_RESPECT
- Source idea: DP-003 + DP-004 (limit enforcement + auth unification)
- Source verdict: ADVANCE
- Rationale: Write-path quota guards and read-path tenancy are complementary halves of the same auth+limits story. Landing one without the other creates a partial migration window.

### C-001-005: Verify data before deleting the legacy chat shim
- Type: MUST_TEST
- Source idea: DP-002, I-001-005
- Source verdict: INCONCLUSIVE
- Rationale: The courseTutor.getChatsForSpace N+1 shim filters on spaceId === undefined. Before deletion, run a Convex query to confirm zero documents match. If any exist, backfill first.

## Constraints passed to next cycle's Wave α

| Constraint ID | Text (1 sentence) | Type | Decay score | Tag |
|---|---|---|---|---|
| C-001-001 | Do not collapse the two AI paths (Convex actions vs Next routes); fix drift within each. | MUST_RESPECT | 1.00 | [ai, architecture] |
| C-001-002 | Delete confirmed dead code before extracting new shared helpers. | MUST_RESPECT | 1.00 | [dead-code, ordering] |
| C-001-003 | Do not add Next-style 429 retry to Convex actions. | MUST_AVOID | 1.00 | [ai, convex, retry] |
| C-001-004 | Land limit enforcement (DP-003) and auth unification (DP-004) in the same wave. | MUST_RESPECT | 1.00 | [auth, limits, sequencing] |
| C-001-005 | Verify zero spaceId===undefined docs before deleting the legacy chat shim. | MUST_TEST | 1.00 | [data-verification, course] |

## Constraints decayed this cycle
(none — first cycle)

## Constraints archived this cycle
(none — first cycle)

## Implementation priority order (recommended for cd-review handoff)

1. **DP-002** (dead code) — zero risk, highest confidence, unblocks everything else
2. **DP-001** (AI consistency) — largest convention win, touches the most files
3. **DP-005** (streaming resilience) — production reliability, AGENTS.md contract
4. **DP-003 + DP-004** (limits + auth) — land together, complementary halves
