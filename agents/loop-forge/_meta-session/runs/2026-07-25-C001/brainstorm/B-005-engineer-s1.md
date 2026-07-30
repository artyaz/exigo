# B-005 — engineer / s1

## Subagent meta
cycle-001 · B-005 · engineer · s1

## Problem echoed
Design a loop that creates other loops — universal, autonomy-enabling, combinable, mid-task-extracting.

## Inherited constraints echoed
Universal. Combinable as a sub-loop. Mid-task-extractable. Agent decides target-domain autonomy criteria.

## Ideas

### I-001-001: Substitute slice map with a domain-supplied loop-spec
- Source: `agents/cd-review/LOOP.md §4` + `agents/brainstorm/LOOP.md §4`
- SCAMPER: Substitute
- Adaptation: cd-review §4 hard-codes S1–S11 (Convex, courses) — the most GitHub-specific surface; brainstorm §4 already abstracts this into a brief. **Substitute** the slice table with a `loop-spec.md` (target-domain name, autonomy criteria, input/output contract, acceptance gate) — loop-forge's only domain input.
- Why: removes the last GitHub-coupled artifact.
- Riskiest assumption: autonomy criteria are statically spec-able.
- Warrant: brainstorm §4 proves a brief-only cycle runs end-to-end with no slice map.

### I-001-002: Modify the four-wave architecture into audit→design→materialize→review
- Source: `agents/cd-review/LOOP.md §3`
- SCAMPER: Modify
- Adaptation: keep cd-review's wave shape (parallel leaves, orchestrator consolidates, no children) but **modify** each job: A audits the target domain's autonomy surface; B brainstorms loop designs grounded in existing LOOP.md patterns; C materializes the new loop (`LOOP.md`, `RECORD.md`, `day-status.json`, `scripts/*.sh`); D pre-ship-reviews against the forge lens catalog (I-001-004).
- Why: reuses exigo's only battle-tested wave contract.
- Riskiest assumption: converges in ≤3 D-rounds.
- Warrant: §3's "L0 is the only layer that decides sequencing" is domain-agnostic.

### I-001-003: Put day-status.json to another use as the target loop's acceptance oracle
- Source: `agents/cd-review/LOOP.md §0.5.4` + `§10.7`
- SCAMPER: Put-to-another-use
- Adaptation: cd-review's `day-status.json` (state, last_step, blocked_reason, resume_hint) is already crash-safe and launcher-readable. **Put it to another use**: the forged loop emits a status file in exactly this shape, and loop-forge treats it as the test oracle — Wave D kills the target loop at a random `last_step`, then verifies a cold launcher resuming from `day-status.json` + `RECORD.md` "Stopped at" alone succeeds.
- Why: collapses the extractability constraint and its proof into one artifact.
- Riskiest assumption: every domain's state machine fits §10.7's vocabulary.
- Warrant: §0.5.4 enumerates the only fields a cold launcher needs.

### I-001-004: Combine REVIEW-LENS with brainstorm's autonomy invariants
- Source: `agents/cd-review/REVIEW-LENS.md §1` + `agents/brainstorm/LOOP.md §8.6`
- SCAMPER: Combine
- Adaptation: REVIEW-LENS ships four review lenses; §8.6 lists 8 load-bearing autonomy invariants. **Combine** into loop-forge's Wave D lens set: L1 Autonomy (resume from disk alone? — #3), L2 Universality (free of cd-review/brainstorm names? — #7), L3 Combinability (exposes a sub-loop contract? — #4), L4 Extractability (survives kill-switch mid-β? — #1).
- Why: converts "review the LOOP.md for vibes" into a constraint-keyed checklist.
- Riskiest assumption: L4 requires a run to score.
- Warrant: §8.6 calls its rules "load-bearing — remove any one and autonomy dies."

### I-001-005: Reverse authority — run the forged loop as a worker under loop-forge
- Source: `agents/brainstorm/LOOP.md §0.5.1` + `§8.3`
- SCAMPER: Reverse
- Adaptation: in cd-review/brainstorm the launcher spawns a peer that *runs the loop*. For loop-forge, **reverse**: loop-forge spawns the *target loop* (the thing being forged) as a leaf worker, hands it a tiny `loop-spec.md`, and supervises one micro-cycle. If loop-forge can spawn it, hand it a spec, and read its `day-status.json` + `RECORD.md`, the combinability contract holds.
- Why: makes universality + combinability a runtime proof, not a claim.
- Riskiest assumption: the target's launcher contract is narrow enough to spawn without domain glue.
- Warrant: §0.5.1 already separates launcher (thin) from cycle-scope agent (no HITL) — that boundary is the sub-loop interface.

## Self-report
Ideas: 5 · duplicates skipped: 0 (archive empty) · mutations: 0 · violations: 0. All cite file:section + SCAMPER verb + adaptation.
