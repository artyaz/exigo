# B-004-002 — skeptic / s1

## Meta
- loop_id: loop-004
- subagent_id: B-004-002
- persona: skeptic
- seed: s1

## Target domain echoed
An autonomous loop that reviews the visual/interaction layer of the exigo Next.js app — now with real pixels — whose new eyes create fresh failure modes, not merely fewer.

## Design decisions

### I-004-021: The screenshot narrator and the finding proposer must be different steps, and the gate reads only pixels the proposer never described
- Decision: Split perception into a capture step (µ writes the JPEG + raw a11y tree to perceptual-register-port) and a separate ε gate step that receives ONLY the artifact bytes and the mechanical finding's *claim*, never the proposer's prose about the image. ε must independently re-derive whether the pixels support the claim. If µ's narration reaches ε, the gate is void.
- Failure mode it prevents: A single worker proposes "button too low-contrast," reads its own screenshot, and confirms itself — self-preference bias relabeled as "objective pixels."
- Parent loop: loop-forge
- Riskiest assumption: A screenshot the proposer did not *author* is still one the proposer *interprets*; separating capture from narration only helps if ε re-reads the raw bytes rather than inheriting µ's caption.
- Warrant: §7.3 — self-preference survives objective criteria; the artifact must gate an interpreter blind to the proposer's words, or it merely relocates the bias from text to caption.

### I-004-022: A screenshot never upgrades a verdict's evidence class; PERCEPTUAL claims carry only what the pixels alone decide
- Decision: Forbid any finding from citing a screenshot to assert a numeric or computed property (contrast ratio, hit-target px). PERCEPTUAL tags may claim only pixel-decidable facts (present/absent, overlapping, clipped). Any numeric stays DERIVED with a CSS file:line source. The bench MUST reject a PERCEPTUAL finding that states a number.
- Failure mode it prevents: Eyes make "I can see 4.5:1 contrast" feel measured; the JPEG becomes the license for the exact AC-02 fabrication no script-eval tool can catch.
- Parent loop: cd-review
- Riskiest assumption: "Pixel-decidable" is itself judgeable by the same model that wants to over-claim, so the class boundary is only as honest as the bench's ability to spot a number inside a PERCEPTUAL tag.
- Warrant: AC-02 STANDS (no computed-style API); a screenshot corroborates existence, never magnitude, so magnitude must route through DERIVED.

### I-004-023: Publish budget is decremented BEFORE the publish call and never credited back
- Decision: MAX_PUBLISHED_ARTIFACTS is a monotonic pre-flight counter: the loop reserves a slot, then publishes; the counter never decrements on "cleanup." No UnpublishFile appears in any success path. Exhausting the reserve forces `scope_complete` clean exit, never a bypass.
- Failure mode it prevents: A loop that trusts UnpublishFile publishes freely "because it cleans up after" — but the inner URL stays live, so every cycle permanently leaks product UI.
- Parent loop: none
- Riskiest assumption: The cap number is chosen before knowing how many surfaces matter, so a too-tight cap silently starves review while a too-loose one still leaks at scale.
- Warrant: Measured — UnpublishFile returns `{unpublished:true}` yet the inner URL still renders; reversibility is false, so the only real control is refusing to publish.

### I-004-024: A "partial" bench detection counts as a MISS for promotion arithmetic
- Decision: The bench-report-port scores promotion on strict full-detection recall: the 2 "partial" arms count as failures, not credits. Promotion requires full detection of every planted defect AND zero clean-arm findings. Partials are logged but never inflate the pass rate.
- Failure mode it prevents: A passing bench (6/2/0) invites reading "partial" as "basically caught it," so a reviewer that half-sees defects self-promotes — recall-only scoring dressed as rigor.
- Parent loop: brainstorm
- Riskiest assumption: Treating every partial as a miss may reject a genuinely useful reviewer over labeling nuance, trading a leak-risk for a promotion deadlock.
- Warrant: AC-06 lifted on discrimination, but 2/8 arms were only partial; counting partials as passes is exactly the rubber-stamp the clean arm exists to block.

### I-004-025: Novelty-decay is measured on the finding set, not the pixels
- Decision: The 3-cycle retire counts consecutive cycles with zero *new deduplicated findings* (keyed by surface + control + evidence class), explicitly ignoring pixel-diff or JPEG-hash changes. A re-render that differs only in compression/timestamp is NOT novelty.
- Failure mode it prevents: Eyes produce a byte-different JPEG every capture; a loop keyed on "did the image change" never decays, re-publishing and re-finding forever, defeating the blast-radius cap.
- Parent loop: loop-forge
- Riskiest assumption: Two renders of a truly-changed surface may dedupe to "no new finding" if the change is visual-only and no mechanical class fires, retiring a surface that still regressed.
- Warrant: Stop conditions require novelty-decay; pixel noise is not signal, so decay must key on judged findings or it never terminates under permanent publishing.

## Self-report
- Decisions generated: 5
- Decisions discarded as too vague to carry a riskiest assumption: 2 (a "cache-bust every screenshot" rule — no failure it structurally prevents once revocation is dead; a "human spot-check between cycles" rule — smuggles a reviewer into the worker, forbidden)
