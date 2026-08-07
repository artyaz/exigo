# B-004-005 — synthesizer / s1

## Meta
- loop_id: loop-004
- subagent_id: B-004-005
- persona: synthesizer
- seed: s1

## Target domain echoed
An autonomous loop that reviews exigo's visual/interaction layer through the one validated bridge — publish → inner `pub.hyperagent.com/p/<token>` → browser — where every look costs a permanent public leak.

## Design decisions

### I-004-041: The contact-sheet publish (many surfaces, one irreversible artifact)
- Ingredient A: film photography — the **contact sheet**: a whole roll printed to one frame so a photographer judges 36 exposures at the cost of one print.
- Ingredient B: sprite-atlas packing from game-engine asset pipelines — many discrete images composited into a single addressable texture.
- Fused mechanism: δ authors ONE static HTML that stacks every admitted route×state render (from `surface-manifest-port`) as labelled sections in a single document, then publishes that one file. The browser scrolls/screenshots each section as its own evidence, so N surfaces are audited while the permanent-leak count charged against `MAX_PUBLISHED_ARTIFACTS` rises by exactly 1.
- Contradiction resolved by: separation in **scale** — publish-many collapses to publish-one because the unit of leak (artifact) is decoupled from the unit of review (section).
- Parent loop: none
- Riskiest assumption: composited sections render identically to standalone route renders (no layout bleed between stacked components).
- Warrant: `BrowserGetContent`/`BrowserScreenshot` operate on the post-render inner DOM regardless of how many components share the page (measured: DOM obtainable on inner URL).

### I-004-042: Repo-first triage gate (spend a leak only on the undecidable)
- Ingredient A: emergency-room **triage** — cheap non-invasive assessment first; the expensive scarce resource (a bed) is committed only to cases that cannot be cleared otherwise.
- Ingredient B: compiler warnings-as-errors — everything statically decidable is settled before any runtime cost.
- Fused mechanism: μ runs ALL mechanical checks derivable from repo source first — heading order, missing `alt`, `<label for>`, `<div onclick>`, CSS-derived contrast/hit-target. Only surfaces carrying a residual PERCEPTUAL claim that source alone cannot corroborate earn a slot in the I-004-041 contact sheet. Static-decidable defects never trigger a publish at all.
- Contradiction resolved by: separation in **condition** — publish happens only under the condition "mechanically undecidable," shrinking the publish set to the genuine pixel-only residue.
- Parent loop: cd-review
- Riskiest assumption: the perceptual residue (real contrast/geometry ambiguity) is a small fraction of total findings.
- Warrant: bench shows 6/8 defects are mechanical/DOM-derivable; only contrast (#1,#2) is intrinsically pixel-bound.

### I-004-043: Golden-master diff as the external gate
- Ingredient A: software **golden-master (approval) testing** — a frozen known-good artifact; any deviation is the signal, and the proposer cannot edit the master.
- Ingredient B: numismatic **grading** — an independent grader assigns a class the coin's owner cannot self-award.
- Fused mechanism: the clean fixture is the golden master. ε re-runs both bench arms and writes `gate-verdict-port` from the *diff* against clean (clean-arm FP count is the disqualifier), a JSON the δ proposer has no write path to. A screenshot alone is NOT the gate; the pass/fail is the clean-vs-planted delta, defeating self-preference.
- Contradiction resolved by: n/a (resolves the self-gate / AC-06 problem, not the publish contradiction).
- Parent loop: loop-forge
- Riskiest assumption: the clean fixture stays representative as real surfaces diversify.
- Warrant: spec §7.3 flags screenshot-as-gate as insufficient; AC-06 mandates both arms with clean-arm FPs as failure.

### I-004-044: Evidence-class provenance envelope
- Ingredient A: scientific-paper **methods section** — no result without its stated derivation.
- Ingredient B: **HTTP content-type headers** — every payload self-declares how to interpret it.
- Fused mechanism: every finding is emitted as a typed record {claim, evidence_class ∈ MECHANICAL-DOM | MECHANICAL-CSS-derived | PERCEPTUAL-pixels | A11Y-tree, derivation_source}. A numeric contrast/px claim without a CSS-token or pixel source is structurally unwriteable, and mechanical/perceptual records route to separate ports (never merged).
- Contradiction resolved by: separation in **space** — mechanical and perceptual claims live in disjoint output ports so an unbounded perceptual guess cannot contaminate the mechanical register.
- Parent loop: cd-review
- Riskiest assumption: authors won't smuggle a pixel guess into the CSS-derived class.
- Warrant: AC-02/AC-07 make provenance mandatory; bench #6 shows geometry needs explicit CSS-derivation.

## Self-report
- Decisions generated: 4
- Decisions resolving the publish/permanence contradiction by separation: 2 (I-004-041 scale, I-004-042 condition)
