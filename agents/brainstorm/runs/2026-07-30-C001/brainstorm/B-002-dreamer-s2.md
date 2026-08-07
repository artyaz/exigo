# B-002 — dreamer / s2

## Subagent meta
- cycle_id: cycle-001
- subagent_id: B-002
- persona: dreamer
- seed: s2
- oblique_card: "Honour thy error as a hidden intention"
- started_at: 2026-07-30T00:00:00Z
- completed_at: 2026-07-30T00:00:00Z

## Problem echoed
How should Exigo build an autonomous UX design/review loop when the loop has no eyes and the only existing UX process is a pile of manually-iterated v2/v3/v4 screenshots?

## Seed reframe echoed
Instead of eliminating the ugly iteration trail, I treat every error state — the fossil PNGs, the broken render, the layout that shifted — as the loop's richest and most trustworthy signal.

## Inherited constraints echoed
- none (cycle-001)

## Ideas

### I-001-011: The Fossil Diff Loop
- Description: The loop never judges a screen in isolation; it only judges *deltas between error-generations*. It ingests the v2→v3→v4 lineage (filename suffixes are the ground-truth edit-order), reconstructs each version from git blame + component source at that commit, and treats "what the human changed between v2 and v3" as a labelled training signal for what "wrong" looked like. The loop's verdict is: "given the direction of past corrections, is this new state moving with or against the correction gradient?"
- Why it's novel: It mines the *human's own bug-fixes* as the rubric rather than importing an external design heuristic.
- Riskiest assumption: The v2/v3/v4 filename order actually corresponds to improvement, not random experimentation.
- Warrant: The suffixes exist and are monotonic, so an ordering signal is already sitting in the repo for free.
- Parent idea: (none)

### I-001-012: Error-Museum — the loop curates its own failures
- Description: A dedicated `agents/ux-review/museum/` where the loop *deliberately preserves* every broken intermediate render it produces (failed Tailwind compile, mid-transition framer-motion frame, empty-state that should never render). Each fossil is captioned with the source-diff that caused it. Future runs consult the museum first: "have we made this class of mistake before?" The museum grows into a repo-specific catalogue of *how this codebase breaks*, which is more valuable than a generic a11y checklist.
- Why it's novel: It inverts the usual instinct to discard broken output — the broken output becomes the institutional memory.
- Riskiest assumption: Classes of breakage recur often enough that a catalogue pays off.
- Warrant: The sixteen root PNGs prove someone already keeps intermediate states, so preservation matches observed behaviour.
- Parent idea: (none)

### I-001-013: Intentional Vandalism Wave
- Description: A wave that, before reviewing, *deliberately corrupts* the component — deletes the loading state, injects a token off-by-one, forces `overflow: visible` — renders the DOM/JSX mentally, and asks "would I notice this is wrong from source alone?" If the loop can't detect its own planted error, it has proven it is blind on that axis and must abstain there. Self-sabotage becomes the honesty gate.
- Why it's novel: It uses injected errors as a *calibration probe* for the loop's own perceptual blind spots.
- Riskiest assumption: A source-level loop can reliably detect planted defects it introduced.
- Warrant: Mutation-testing already validates test suites this way, so the pattern is transferable to review-suites.
- Parent idea: (none)

### I-001-014: The Layout-Shift Séance
- Description: Since the loop has no browser, it *conjures* the shift instead of measuring it. From JSX + Tailwind classes it predicts every place a render could jump (image without dimensions, font swap, conditional block above the fold) and emits a ranked "ghost CLS" report — a hauntology of shifts that haven't happened yet. The absent screenshot is treated not as a missing capability but as a séance prompt.
- Why it's novel: It reframes the no-eyes limitation as a *forecasting* task rather than a measurement task.
- Riskiest assumption: Static source contains enough info to predict most layout shifts.
- Warrant: CLS causes (undimensioned media, late-loading fonts) are structurally visible in source, so prediction is grounded.
- Parent idea: (none)

### I-001-015: Regret Log — verdicts that expect to be wrong
- Description: Every verdict ships with a pre-written "if this is wrong, here's how you'll find out" clause — a falsifiable trap the *next* cycle checks. The loop honours its future error as an intention: it plants tripwires for its own mistakes. A verdict isn't `ADVANCE`; it's `ADVANCE-until-tripwire-fires`.
- Why it's novel: It bakes self-falsification into the verdict object rather than into a separate audit.
- Riskiest assumption: Useful tripwires can be authored at verdict time.
- Warrant: The brief already demands a falsifiable riskiest assumption per decision, so tripwire-authoring is one step further along an existing requirement.
- Parent idea: (none)

### I-001-016: The Ugliness Budget
- Description: The loop is granted a quota of *allowed* ugliness per screen and spends it on purpose — intentionally leaving one rough edge visible and annotated ("this scrollbar is ugly; it is cheaper than the fix"). Honouring error as intention means naming the errors you choose to keep, so they never masquerade as oversights.
- Why it's novel: It converts unfixed defects from silent debt into an explicit, budgeted design decision.
- Riskiest assumption: Teams prefer named tradeoffs over an aspiration of pixel-perfection.
- Warrant: The `-migrated` suffix shows real work ships in visibly transitional states, matching a tolerance for budgeted ugliness.
- Parent idea: (none)

### I-001-017: Screenshot as Confession
- Description: When (later) a screenshot capability exists, the loop treats a captured image not as proof-of-correctness but as a *confession to be cross-examined*: it must reconcile the pixels against its source-only prediction, and every mismatch is logged as "the render surprised me here." Surprises, not successes, are the payload — the loop reports where reality diverged from its model of reality.
- Why it's novel: It makes the screenshot subordinate to the prediction, so the image can never rubber-stamp on its own.
- Riskiest assumption: Prediction-vs-render reconciliation is cheaper than trusting the render outright.
- Warrant: The central tension warns the loop will rubber-stamp what it sees, and cross-examination structurally blocks that.
- Parent idea: (none)

## Self-report
- Ideas generated: 7
- Ideas skipped as duplicate of novelty archive: 0 (empty archive)
- Mutations of prior-cycle ideas: 0
- Constraint violations caught and corrected: 1
