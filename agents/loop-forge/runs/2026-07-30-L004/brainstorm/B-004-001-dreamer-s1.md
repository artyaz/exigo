# B-004-001 — dreamer / s1

## Meta
- loop_id: loop-004
- subagent_id: B-004-001
- persona: dreamer
- seed: s1

## Target domain echoed
An autonomous loop that reviews and improves the visual and interaction layer of the exigo app, now that it genuinely has eyes.

## Design decisions

### I-004-001: The Golden Diptych — clean fixture is a live baseline, not just a canary
- Decision: Every published surface ships as a *diptych*: the surface under review beside the clean-fixture equivalent, both screenshotted in the same cycle. Wave π's perceptual claims must be phrased as *comparative* ("washed out relative to the clean baseline") not absolute. The clean arm stops being only ε's false-positive check and becomes π's calibration eye — pixels judged against pixels, never against an imagined ideal.
- Parent loop: brainstorm (paired-fixture discrimination)
- Riskiest assumption: A same-cycle clean baseline exists for every reviewable surface.
- Warrant: Bench proved contrast defects read as *relative* washout; a co-rendered baseline turns that into a repeatable comparison.

### I-004-002: The Perceptual Register is a promotion queue
- Decision: The perceptual-register-port is not a graveyard for "unjudgeable" items — it is a *promotion queue*. Each cycle, one perceptual claim that recurs across N surfaces gets a proposed *mechanical rule* drafted (e.g. a Tailwind-token contrast lookup). The rule ships to bench; if both arms pass, the item migrates from perceptual to mechanical. Cycle-001's unjudgeable items thus decay toward mechanical over time.
- Parent loop: loop-forge (bench-gated primitive promotion)
- Riskiest assumption: Recurring perceptual claims reduce to CSS-source-derivable rules.
- Warrant: §7-Q2 asks where the line now sits; making it a *moving* line answers it structurally.

### I-004-003: Two eyes, two verdicts — the DOM/a11y cross-check is a first-class wave
- Decision: Elevate AC-03's cross-check into its own consolidation step: π emits *paired* observations (DOM-says vs tree-says) and a finding fires only on agreement or on informative *disagreement* (bench #5 mask, #7 phantom-button). A claim backed by one source alone is auto-demoted to the perceptual register. Substitution becomes structurally impossible, not merely forbidden.
- Parent loop: cd-review (dual-signal gating)
- Riskiest assumption: Every finding class maps cleanly to a DOM-vs-tree pairing.
- Warrant: The two partials both arose from source-vs-source mismatch; the mismatch *is* the signal.

### I-004-004: Publish-once, review-forever — the artifact ledger
- Decision: Since publishing is permanent, treat each published token as a durable asset in an append-only ledger keyed by (surface, content-hash). A re-review reuses the existing token when the hash is unchanged, spending zero blast-radius budget. MAX_PUBLISHED_ARTIFACTS is then a cap on *novelty*, not on review volume — the loop can re-examine forever while publishing only when pixels actually change.
- Parent loop: cd-review (idempotent re-entry via last_step)
- Riskiest assumption: A stable content-hash per surface is derivable pre-publish from the static export.
- Warrant: §7-Q4 needs the cap useful; hashing decouples review count from irreversible cost.

### I-004-005: The screenshot is evidence, the gate is a stranger
- Decision: A screenshot can *justify* a verdict but can never *be* the gate. The gate-verdict-port is authored by ε reading π's bound claims against the bench arms — the proposer never sees the gate write path. To break self-preference (C-001-004), ε scores the surface *and* its clean twin blind to which is which; a gate that can't tell them apart is a bench failure.
- Parent loop: loop-forge (externalized adversarial gate)
- Riskiest assumption: ε can be presented the pair unlabeled without leaking provenance.
- Warrant: §7-Q3 doubts a screenshot alone; blinding the gate makes self-preference structurally unrewarding.

## Self-report
- Decisions generated: 5
- Criteria violations caught and corrected: 1 (I-004-004 first framed cap as bypassable; rewrote so novelty-only publishing still respects AC-08's hard cap and permanence).
