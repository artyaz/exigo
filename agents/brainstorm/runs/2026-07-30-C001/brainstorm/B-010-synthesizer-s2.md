# B-010 — synthesizer / s2

## Subagent meta
- cycle_id: cycle-001
- subagent_id: B-010
- persona: synthesizer
- seed: s2
- oblique_card: "Only one element of each kind"
- started_at: 2026-07-30T00:00:00Z
- completed_at: 2026-07-30T00:00:00Z

## Problem echoed
How to structure an autonomous UX design/review loop for a Next.js app whose harness has no browser eyes and where perceptual quality resists mechanical checking.

## Seed reframe echoed
The card forbids the fan-out reflex (cd-review's 4 lenses, brainstorm's 10 personas): I designed a loop allowed exactly ONE of each thing, treating radical reduction as the right shape for deep single-screen critique.

## Inherited constraints echoed
- none (cycle-001)

## Ideas

### I-001-091: The Single Contact Sheet
- Ingredient A: photography — the darkroom **contact sheet** (all frames of one roll on one page).
- Ingredient B: React — the **component render tree** of one route.
- Fused mechanism: The loop's ONE artifact per cycle is a single markdown "contact sheet" of ONE screen: every state React can produce (loading / empty / error / populated / focus-visible) rendered as ASCII-boxed DOM snapshots via a headless React-DOM `renderToString`, stacked vertically. No pixels, no browser — just the DOM the source *actually emits* per state. The reviewer critiques states side-by-side on one page.
- The "one of each kind": ONE artifact (the sheet) replaces cd-review's 4 lens files; it is also the loop's only render.
- Why it's novel: it obtains visual-adjacent evidence (all states of one screen) from `renderToString` alone, sidestepping the no-eyes constraint without faking pixels.
- Riskiest assumption: state coverage can be enumerated from source (prop/hook branches) reliably enough to render each.
- Warrant: the repo's `arena-v2/v3/v4.png` fossils show the real workflow iterates one screen across states — a contact sheet is that workflow's native artifact.
- Parent idea: (none)

### I-001-092: The One-Verdict Rubber-Stamp Trap
- Ingredient A: aviation — the **checklist challenge-response** (one item, spoken, forced answer).
- Ingredient B: statistics — the **null hypothesis** ("the screen is broken until evidence says otherwise").
- Fused mechanism: The loop emits exactly ONE verdict, and it defaults to REJECT. To flip to ADVANCE the single reviewer must file the ONE mandatory finding as a challenge-response pair: it must *quote the exact source line* proving a specific state exists (e.g. the `isLoading &&` branch). If it cannot cite a line, the verdict stays REJECT by construction. Structural anti-sycophancy: a rubber-stamp is impossible because "pass" requires a quotable artifact, not an opinion.
- The "one of each kind": ONE verdict, defaulting negative, replacing cd-review's 3-state-per-lens matrix.
- Why it's novel: it makes honesty a *default state* rather than a persona instruction — the loop cannot hallucinate a pass.
- Riskiest assumption: source-line citation is a strong enough proxy for "state renders correctly" to gate on.
- Warrant: §4.3 warns the loop "will rubber-stamp or hallucinate"; forcing the burden of proof onto the passer is the only structural cure available without a second model.
- Parent idea: (none)

### I-001-093: The Solo Pentimento Diff
- Ingredient A: art conservation — **pentimento** (the earlier painting showing through the current one).
- Ingredient B: version control — the **git two-dot diff** of one component file.
- Fused mechanism: The loop's ONE before/after pair is not two screenshots but ONE rendered overlay: it re-runs the contact-sheet render against `HEAD~1` and against `HEAD` for the SAME screen, then emits a single unified text diff of the two DOM strings. Changed nodes are the pentimento — what "showed through" from the prior design. The reviewer critiques only the delta, not the whole screen.
- The "one of each kind": ONE before/after pair (a diff, not a gallery) replacing manual `-v2/-v3` file proliferation.
- Why it's novel: it converts the repo's suffix-fossil workflow into a first-class DOM-level regression signal with zero visual tooling.
- Riskiest assumption: DOM-string diffs are legible enough to reveal meaningful UX regressions, not just noise.
- Warrant: the sixteen root PNGs *are* manual before/afters; one text diff replaces the whole fossil pile.
- Parent idea: (none)

### I-001-094: The One-Screen Triage Nurse
- Ingredient A: emergency medicine — **single-patient triage** (one patient, deepest assessment, one disposition).
- Ingredient B: compiler design — **AST source-level lint** of the route's JSX.
- Fused mechanism: The loop picks ONE screen per cycle (highest-churn route from git log) and the ONE reviewer runs deep, not wide: an AST pass over that route's JSX surfaces the mechanical half (missing `aria-*`, hardcoded hex vs Tailwind token, absent loading/error return branches). Depth-over-breadth *is* the triage doctrine — twelve screens shallowly would miss what one screen deeply catches.
- The "one of each kind": ONE screen, ONE reviewer, replacing brainstorm's 10-persona and cd-review's 4-lens fan-out.
- Why it's novel: it argues fan-out is a *text-artifact habit* and that visual review's correct shape is single-target depth.
- Riskiest assumption: churn-ranking picks the screen that most needs review.
- Warrant: a human designer critiques one screen deeply; the card correctly names visual review as the domain where fan-out does not transfer.
- Parent idea: (none)

## Self-report
- Ideas generated: 4
- Ideas skipped as duplicate of novelty archive: 0 (empty archive)
- Constraint violations caught and corrected: 1 (dropped a 5th idea that reintroduced two parallel reviewers — violated "one reviewer")
