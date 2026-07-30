# B-004 — skeptic / s2

## Subagent meta
TASK_ID 1-α-B-004 · cycle-001 · B-004 · persona=skeptic · seed=s2 ("Use an old idea you've already had, but apply it to a different scale") · novelty hashes: empty.

## Oblique strategy applied
Take three circuit-breakers proven in `cd-review` / `brainstorm` — (1) 380k hard kill-switch, (2) 3-state verdict, (3) no-HITL-inside-worker invariant — and re-apply each at a scale the originals never had: per-portfolio external side-effects, per-loop verdict vocabulary, per-loop ship boundary.

## Problem echoed
Design a loop that creates other loops. Universal. Combinable. Mid-task extraction allowed. The agent decides what autonomy means in the target domain.

## Inherited constraints echoed
Universal (not GitHub/research/lesson-specific). Combinable. Mid-task extraction. Two-layer harness (launcher + worker) shared with parents. No HITL inside worker. Crash-safe resume from disk.

## Ideas

### I-003-PRK: Blast-radius kill-switch
- Pattern scaled: 380k token hard kill-switch (`brainstorm` §0.5; `cd-review` §0.5).
- New scale: per-portfolio, external side-effects (not per-spawn tokens).
- Failure mode prevented: forge opens 50 PRs / spawns 30 sub-repos in one cycle because each loop individually passed and no aggregate throttle existed.
- Structural mechanism: launcher-set hard cap on countable external side-effects per forge-cycle: `MAX_OPEN_PRS`, `MAX_SPAWNED_REPOS`, `MAX_FS_MUTATIONS_OUTSIDE_RUNROOT`. Hitting any one forces `state=budget_exhausted` + clean exit regardless of next-loop promise.
- Riskiest assumption: the countable side-effect set is closed; uncounted channels (webhooks, emails) leak blast radius.
- Warrant: a partial throttle on *external* side-effects beats a perfect one on internal tokens — external is where damage is unrecoverable.

### I-004-3SV: 3-state loop-acceptance verdict
- Pattern scaled: `ADVANCE`/`REFUTE`/`INCONCLUSIVE` (`brainstorm` §2).
- New scale: per-loop verdict vocabulary.
- Failure mode prevented: binary ship/drop forces premature commitment to loops needing real-world trial.
- Structural mechanism: every candidate loop gets exactly one of `FORGE` / `REJECT` / `NEEDS-FIELDWORK`. `NEEDS-FIELDWORK` = "shape sound, universality unproven — deploy on one target, re-verdict next cycle." `REJECT` is first-class; absence of any `REJECT` triggers a DA re-dispatch.
- Riskiest assumption: `NEEDS-FIELDWORK` doesn't become a procrastination sink where loops live forever un-shipped.
- Warrant: making "needs trial" first-class is the only honest answer when the success criterion (autonomy) cannot be proven on paper.

### I-007-NHI: No-HITL invariant on ship decisions
- Pattern scaled: no-HITL-inside-the-worker invariant (`cd-review` §0.5.3).
- New scale: per-loop ship boundary — the most tempting place to cheat.
- Failure mode prevented: forge pauses to ask a human "should I open this PR?" and silently becomes a HITL loop, violating the autonomy mandate.
- Structural mechanism: the forge worker may halt only for the four `cd-review`-style fatal reasons (permissions, missing secrets, tool failure ≥3 retries, budget exhausted). "Unsure whether to ship" is not a halt reason; worker must emit a verdict or set `state=fatal_blocked` with a *technical* `blocked_reason`. A pause-for-human on ship is a logged protocol bug.
- Riskiest assumption: the three verdicts plus `fatal_blocked` cover the realistic uncertainty space; a genuinely human-only risk (legal/ethics) has nowhere to go except `REJECT`, which is wrong.
- Warrant: making no-HITL explicit at the ship boundary is what keeps the autonomy mandate non-negotiable.

## Self-report
- Persona mandate honored: each idea names its riskiest assumption; mental drafts ("portfolio quality score", "loop lineage graph", "novelty decay on skeletons") were discarded because no single falsifiable meta-risk could be stated in one sentence.
- No children spawned. No other outputs read. Only the specified path was written. Under 4,000 output tokens.
- Strongest: I-003-PRK — parents only throttled *internal* spend; loop-forge's side-effects are *external* and unrecoverable, so the kill-switch must move with them.
- Weakest (flag for β): I-004-3SV — `NEEDS-FIELDWORK` risks ossifying into an indefinite holding pattern unless a re-verdict deadline is enforced.
