# B-003 — skeptic / s1

## Subagent meta
- cycle_id: cycle-001
- subagent_id: B-003
- persona: skeptic
- seed: s1
- started_at: 2026-07-30T11:26:52Z
- completed_at: 2026-07-30T11:29:40Z

## Problem echoed
How to structure an autonomous UX design/review loop that cannot see a running app, so that it reviews real usability without rubber-stamping or hallucinating the perceptual half.

## Inherited constraints echoed
- none (cycle-001)

## Ideas

### I-001-021: Evidence-typed verdict gate
- Description: Every verdict carries a mandatory `evidence_type` enum (`source`, `dom`, `a11y-tree`, `rendered-artifact`, `none`). The verdict schema rejects any perceptual claim ("hierarchy clear", "discoverable") whose evidence_type is `source` or `none`. A perceptual claim with no artifact does not downgrade to "weak" — it fails to serialize at all, so the loop physically cannot emit an ungrounded feel-verdict.
- Failure mode it prevents: The confident-blind verdict — an eyeless reviewer asserting "the layout reads well" on evidence it never possessed.
- Why it's novel: Novelty=1.0 (empty archive); binds truth-of-claim to type-of-evidence at the schema layer rather than trusting prose discipline.
- Riskiest assumption: That perceptual vs mechanical claims can be cleanly classified at emit-time without a classifier that itself hallucinates the boundary.
- Warrant: §4.3 names rubber-stamp/hallucinate as the primary failure; a schema that won't serialize ungrounded claims removes the failure by construction, touching the verdict format the loop will define.
- Parent idea: (none)

### I-001-022: Twin scorecards that refuse to sum
- Description: The loop maintains two disjoint scorecards — Mechanical (contrast, focus order, hit-target, token drift, ARIA, missing states) and Perceptual (hierarchy, discoverability, feel). There is no aggregate score. A screen with 100% mechanical and 0% perceptual coverage reports as `UNSEEN`, never `PASS`. Coverage of the perceptual card can only rise via a rendered-artifact reviewer (I-001-021), so mechanical wins can never paper over perceptual silence.
- Failure mode it prevents: Mechanical-only masquerade — passing every checkable rule and declaring "good UX," faking the perceptual half by omission.
- Why it's novel: Deliberately withholds the single number product owners want, making unseen-ness a first-class terminal state.
- Riskiest assumption: That a loop is allowed to terminate in `UNSEEN` without a downstream consumer forcing a fake `PASS` for convenience.
- Warrant: §4.3 warns a design ignoring the split will fail; two non-summable cards make omission visible, shaping the loop's scoring artifact.
- Parent idea: (none)

### I-001-023: Pre-registered acceptance criteria (frozen before fix)
- Description: If the loop both reviews and proposes fixes (cd-review shape), the review wave writes acceptance criteria to a hash-locked file before any fix is generated. The fix wave is graded only against that frozen file; it cannot append or edit criteria. A fix that would need a new criterion forces a new review cycle, not a silent goalpost move.
- Failure mode it prevents: Self-grading drift — a reviewer that authors fixes then grades its own fixes leniently against criteria it quietly relaxed.
- Why it's novel: Imports pre-registration (from empirical science) into a self-modifying review loop as a hash-lock, not a norm.
- Riskiest assumption: That review can specify falsifiable acceptance criteria before seeing the fix's shape, rather than criteria being fix-dependent.
- Warrant: §4.5 demands verdicts stay honest; freezing criteria pre-fix targets the exact conflict-of-interest of the audit/fix genome.
- Parent idea: (none)

### I-001-024: Accessibility-tree as the perceptual substrate (no pixels)
- Description: Instead of screenshots the loop reads/renders lie on, the perceptual evidence is a serialized accessibility tree + computed-style digest extracted from the DOM (role, name, order, contrast, size, visibility). Perceptual claims must cite specific tree nodes. This gives extractable, quotable structure for "discoverability" (is the primary action a reachable named button early in tab order?) without asserting perception of a pixel buffer.
- Failure mode it prevents: Screenshot theater — once a headless browser is added later, the LLM hallucinating a verdict from an image it cannot reliably parse.
- Why it's novel: Reframes "eyes" as structure extraction (a11y tree) rather than vision, sidestepping the no-Playwright fact and pixel-hallucination together.
- Riskiest assumption: That the a11y tree captures enough perceptual signal that a passing tree implies a usable screen (it may miss visual grouping/gestalt).
- Warrant: §4.2 fact-1 (no browser tooling) plus §4.3; grounding claims in extractable structure defines what the loop instruments for evidence.
- Parent idea: (none)

### I-001-025: Mandatory-defect adversary (void-on-approval)
- Description: A structural black-hat sub-role must file at least one specifically-located, reproducible defect per screen. If it files none, the review is marked `VOID`, not `PASS` — a clean sheet is treated as reviewer failure, not screen perfection. Anti-sycophancy is enforced by persona + rubric (structural, no second model), mirroring this subagent's own discard rule.
- Failure mode it prevents: Consensus-of-one — single-model sycophancy agreeing with the design's own intent doc and rubber-stamping.
- Why it's novel: Inverts the success signal: silence from the critic invalidates the run instead of blessing it.
- Riskiest assumption: That a forced-defect quota won't manufacture trivial defects to satisfy the quota (noise instead of sycophancy).
- Warrant: §4.4 bars model-diversity and human sign-off; a void-on-approval adversary keeps honesty structural within one model.
- Parent idea: (none)

### I-001-026: Baseline-provenance lock
- Description: The 16 root PNGs (arena-v2..v4, etc.) prove iteration but are themselves unreviewed. No artifact may serve as a comparison baseline until it carries its own recorded verdict + evidence_type. A regression check against an unverified baseline returns `NO-BASELINE`, refusing to certify a screen as "no worse than before" when "before" was never actually reviewed.
- Failure mode it prevents: Stale-baseline rubber-stamp — approving a regression because it matches a prior artifact that was only ever eyeballed.
- Why it's novel: Treats provenance of the baseline (not just the diff) as a precondition for regression verdicts.
- Riskiest assumption: That the loop can bootstrap any trusted baseline at all before enough screens have earned verdicts (cold-start).
- Warrant: §4.2 fact-2 (the PNG fossil record) is unverified evidence; provenance-locking baselines stops that debt from silently anchoring verdicts.
- Parent idea: (none)

## Self-report
- Ideas generated: 6
- Ideas discarded as too vague to carry a riskiest assumption: 1 (a generic "perceptual-claim laundering" idea folded into I-001-021's evidence gate — its assumption duplicated 021's classification risk)
- Ideas skipped as duplicate of novelty archive: 0 (empty archive)
- Constraint violations caught and corrected: 1 (initial I-001-024 draft implied trusting a screenshot; rewrote to a11y-tree substrate to respect §4.2 no-eyes + §4.4 no-vision-hallucination, and confirmed no second-model / human-sign-off / LOOP.md authoring)
