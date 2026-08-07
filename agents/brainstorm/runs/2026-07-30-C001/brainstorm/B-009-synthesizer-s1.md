# B-009 — synthesizer / s1

## Subagent meta
- cycle_id: cycle-001
- subagent_id: B-009
- persona: synthesizer
- seed: s1
- started_at: 2026-07-30T00:00:00Z
- completed_at: 2026-07-30T00:00:00Z

## Problem echoed
Structure an autonomous UX design/review loop that gets reviewable UX signal without eyes and stays honest instead of rubber-stamping.

## Inherited constraints echoed
- none (cycle-001)

## Ideas

### I-001-081: Golden-master diff harness (the PNG fossils become a test oracle)
- Ingredient A: Software testing — snapshot/golden-master testing (a blessed artifact is the assertion; drift is the signal).
- Ingredient B: Paleontology — the repo's 16 root PNGs read as a stratigraphic fossil record (`arena-v2/v3/v4`, `-migrated`) of prior human judgment.
- Fused mechanism: The loop treats each accepted PNG as a *frozen human verdict* and re-derives its structural fingerprint (DOM tree, token usage, ARIA landmarks, hit-target map) from source at review time. It never judges beauty; it judges *divergence from a state a human already blessed*. New screens with no golden inherit the nearest sibling's structural contract. The fossils supply the perceptual ground truth the loop cannot generate.
- Contradiction resolved by: separation in time (a past human perceived; the loop only compares against that frozen perception now).
- Why it's novel: it reuses the untracked PNGs as a verdict oracle instead of discarding them as noise.
- Riskiest assumption: the PNGs correspond to still-current, locatable source components.
- Warrant: §4.2 fact 2 names the PNGs as evidence about the real workflow; separation-in-time is a canonical TRIZ resolution.
- Parent idea: (none)

### I-001-082: Contrast-as-compile-error (linter borrows the type-checker's failure model)
- Ingredient A: Compiler design — a type error blocks the build with a located, deterministic message.
- Ingredient B: Accessibility auditing — WCAG contrast/hit-target/focus-order rules, normally advisory.
- Fused mechanism: The mechanical half of §4.3 is extracted from JSX + Tailwind tokens statically (no browser) and emitted as *typed diagnostics* against `src/app/_components/`, each with a file:line and a pass/fail that gates like `tsc`. The loop earns the right to speak on mechanics deterministically, so its scarce perceptual budget is never spent re-deriving contrast.
- Contradiction resolved by: separation in scale (mechanical rules run per-token/per-node; perception runs per-screen).
- Why it's novel: promotes a11y checks from advisory lint to build-gating type errors sourced from Tailwind tokens.
- Riskiest assumption: enough contrast/target facts survive static extraction without a rendered DOM.
- Warrant: §4.3 marks contrast/hit-target as source-checkable; §4.2 lists no axe-core, so this fills a named gap.
- Parent idea: (none)

### I-001-083: Prediction-market verdict ledger (forecasting meets code review)
- Ingredient A: Prediction markets — a claim is only credible if the claimant stakes on a future-resolvable outcome.
- Ingredient B: CI review gates — verdicts recorded per change.
- Fused mechanism: Every perceptual verdict ("this state is discoverable") must be written as a *falsifiable bet* resolvable by a later mechanical fact (e.g. "the empty-state renders <=1 CTA above fold" → checkable from JSX). A verdict with no future-checkable resolution is rejected unrecorded. Rubber-stamps become impossible because an ungrounded claim literally cannot be logged.
- Contradiction resolved by: separation by condition (perception is *allowed* only on the condition that it commits to a mechanically-resolvable prediction).
- Why it's novel: converts anti-hallucination from a prompt plea into a structural admissibility rule on verdicts.
- Riskiest assumption: most useful perceptual claims can be phrased as mechanical bets.
- Warrant: §4.5 requires falsifiable riskiest assumptions per decision; this generalizes that to every verdict.
- Parent idea: (none)

### I-001-084: State-machine enumeration as legibility census (protocol design meets a checklist)
- Ingredient A: Protocol/UI state-machine modeling — every interactive surface has loading/empty/error/success/disabled states.
- Ingredient B: Epidemiology census — count presence/absence across a population rather than judging any one case.
- Fused mechanism: The loop enumerates the required state-set for each surface under `src/app/` and audits source for the *presence* of each branch, reporting a coverage census (which of `playground/spaces/settings/...` handle empty vs. error). It answers "is this legible?" indirectly by proving states exist, not by feeling them.
- Contradiction resolved by: separation in space (judge the state *inventory* mechanically, leave the *feel* of each state out of scope).
- Why it's novel: reframes legibility as measurable state-coverage instead of perceptual taste.
- Riskiest assumption: missing-state absence is statically detectable in this tRPC/Convex data-fetch style.
- Warrant: §4.3 explicitly lists "missing loading/empty/error states" as mechanically checkable.
- Parent idea: (none)

### I-001-085: Alt-text render (screen-reader accessibility becomes the loop's only eye)
- Ingredient A: Accessibility — a screen reader linearizes a DOM into a text transcript for a non-seeing user.
- Ingredient B: Literary criticism — reviewing a *transcript* for hierarchy, order, and ambiguity.
- Fused mechanism: Rather than fake sight, the loop renders each component to its accessibility transcript (heading order, landmark labels, control names, reading order) from JSX and reviews *that text*. It legitimately perceives structure through the same channel a blind user does — no browser, no hallucinated pixels. Perceptual review of hierarchy happens on a modality the loop actually possesses.
- Contradiction resolved by: separation in scale (drop from pixel-space to a text modality the model can honestly read).
- Why it's novel: makes the no-eyes constraint an asset by adopting the blind-user modality as canonical.
- Riskiest assumption: a faithful a11y transcript is derivable from source without a live render.
- Warrant: §4.2 confirms zero screenshot capability; §4.3's "information hierarchy" maps cleanly onto heading/landmark order.
- Parent idea: (none)

### I-001-086: Red-team persona pair (immune-system self/non-self meets adversarial review)
- Ingredient A: Immunology — the immune system needs a distinct non-self detector so a cell doesn't clear itself.
- Ingredient B: Security red-teaming — an adversary paid to find failure, not to approve.
- Fused mechanism: Split the worker into a Designer persona (proposes) and an antagonist Critic persona at a *different temperature* whose reward is finding one concrete usability defect per screen; a "looks fine" from the Critic is a null result, not a pass. Structural anti-sycophancy per §4.4 without a second model. The two personas cannot both rubber-stamp because each is scored on the opposite outcome.
- Contradiction resolved by: n/a (this addresses honesty/sycophancy, not the perceive contradiction directly).
- Why it's novel: encodes self/non-self separation as a temperature-split persona reward, obeying the single-model rule.
- Riskiest assumption: temperature/persona split yields genuinely uncorrelated verdicts within one model.
- Warrant: §4.4 mandates structural (persona/temperature) anti-sycophancy; brainstorm's own α/β/γ split is precedent.
- Parent idea: (none)

### I-001-087: Token-drift seismograph (financial reconciliation meets design systems)
- Ingredient A: Accounting reconciliation — every entry must trace to the ledger of record; unmatched entries are flagged.
- Ingredient B: Design systems — Tailwind tokens are the ledger of record for spacing/color/type.
- Fused mechanism: The loop treats the Tailwind v4 token set as the general ledger and reconciles every literal value in `src/app/_components/` against it, emitting a drift report (hard-coded hex, off-scale spacing) ranked by frequency. It measures "is the design system applied consistently?" as an unreconciled-value count — a mechanical proxy for a consistency question usually judged by eye.
- Contradiction resolved by: separation in space (reconcile token-space mechanically; consistency-of-feel stays untouched).
- Why it's novel: applies double-entry reconciliation logic to design tokens as a consistency metric.
- Riskiest assumption: Tailwind v4's token config is complete enough to be the authoritative ledger.
- Warrant: §4.2 names Tailwind v4 and §4.3 lists "token drift" as mechanically checkable.
- Parent idea: (none)

## Self-report
- Ideas generated: 7
- Ideas that resolve the perceive/cannot-perceive contradiction by separation: 6 (I-081 time, I-082 scale, I-083 condition, I-084 space, I-085 scale, I-087 space)
- Ideas skipped as duplicate of novelty archive: 0 (empty archive)
- Constraint violations caught and corrected: 1 (dropped an early "designer signs off" variant per §4.4; reframed as I-086 persona split)
