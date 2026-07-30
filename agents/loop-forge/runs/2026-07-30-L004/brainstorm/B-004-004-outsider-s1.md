# B-004-004 — outsider / s1

## Meta
- loop_id: loop-004
- subagent_id: B-004-004
- persona: outsider
- seed: s1

## Target domain echoed
An autonomous loop that judges the rendered visual/interaction layer of the exigo app against a reference under controlled conditions, then publishes fixes irreversibly under a cap.

## Design decisions

### I-004-031: Snellen-line acuity ladder for the contrast gap
- Donor domain: optometry (visual acuity charts)
- The analogy: A Snellen chart never measures the eye — it presents graded stimuli and records the smallest line legible. The screenshot is the "eye's view"; graded CSS-derived contrast tiers are the chart lines.
- Decision: Publish a per-surface ladder of swatches at declared contrast tiers (e.g. 3:1, 4.5:1, 7:1) derived from Tailwind tokens, alongside the real component. The verdict names the lowest tier still legible in the screenshot. This bounds contrast without ever narrating a ratio the loop never computed (AC-02), turning the geometry gap into a discrimination task the pixels *can* answer.
- Parent loop: none
- Riskiest assumption: JPEG banding does not shift the legibility threshold by a full tier.
- Warrant: bench #1/#2 show pixels resolve contrast qualitatively; the ladder makes that qualitative read defensibly ordinal.

### I-004-032: Press-check control strip on every published proof
- Donor domain: printing-press proofing (SWOP color-bar control strip)
- The analogy: Pressmen never trust a proof alone — a control strip of known patches prints in the trim so drift is read against a fixed reference. The clean fixture is that strip; every published surface carries it.
- Decision: Each published artifact composites the clean-arm reference beside the surface under review. Wave ε reads the strip first: if a known-good patch trips a rule, the run is a bench failure, not a finding (AC-06). One reference embedded per proof makes clean-arm calibration inseparable from the review, so recall can never be scored without its false-positive arm.
- Parent loop: cd-review
- Riskiest assumption: compositing does not itself introduce artifacts the bare surface lacks.
- Warrant: bench notes recall-without-clean-arm is exactly how a rubber-stamp scores well.

### I-004-033: D65 light-booth — one declared viewing condition
- Donor domain: textile quality grading under a standard light booth
- The analogy: Fabric graded under different light is ungradable; mills fix illuminant (D65), angle, distance. The browser viewport, device pixel ratio, and theme are the loop's "illuminant."
- Decision: Pin one canonical capture condition — fixed viewport, color scheme, and zoom — recorded in the evidence class of every verdict (AC-07). Findings captured under any other condition are quarantined, not compared. This kills phantom "defects" that are really lighting drift, and makes two runs' screenshots genuinely comparable.
- Parent loop: none
- Riskiest assumption: a single fixed condition still surfaces responsive-breakpoint defects.
- Warrant: AC-07 already demands evidence provenance; the booth extends it to capture conditions.

### I-004-034: Independent double-check — two blind sources must reconcile
- Donor domain: pharmacy dispensing double-checks
- The analogy: A dispensed drug is verified by a second, *independent* read of the original script, never by trusting the first read. The DOM and the a11y tree are the two independent reads of one surface.
- Decision: No verdict ships on a single source. DOM-derived and a11y-tree-derived observations are recorded blind, then reconciled; a mismatch is itself the finding (AC-03). Bench #5 (placeholder masks a missing label) and #7 (`div onclick`) are precisely mismatches — so reconciliation is the detector, not a fallback.
- Parent loop: none
- Riskiest assumption: the two sources fail independently, not from one shared upstream error.
- Warrant: bench #5/#7 are only catchable as cross-source disagreements.

### I-004-035: Forensic scale-bar in every capture frame
- Donor domain: forensic photography documentation protocols
- The analogy: Evidence photos include an ABFO scale in-frame so size is recoverable from the image, not from testimony. A known-length rule composited into the screenshot restores the missing geometry API.
- Decision: Composite a fixed-pixel ruler (e.g. a 24px reference block) into every capture. Hit-target sizes (bench #6) are then read off the image against the in-frame scale rather than asserted, keeping the measurement bound to visible evidence (AC-02) despite no `getBoundingClientRect`.
- Parent loop: none
- Riskiest assumption: the composited ruler renders at the same scale as the surface under all zoom states.
- Warrant: bench #6 is the sole capability gap; an in-frame scale is the non-script route to it.

## Self-report
- Decisions generated: 5
- Donor domains used: optometry (Snellen acuity); printing-press proofing (control strip); textile grading (D65 light booth); pharmacy dispensing (independent double-check); forensic photography (in-frame scale bar)
