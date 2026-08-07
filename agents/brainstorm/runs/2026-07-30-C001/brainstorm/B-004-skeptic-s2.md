# B-004 — skeptic / s2

## Subagent meta
- cycle_id: cycle-001
- subagent_id: B-004
- persona: skeptic
- seed: s2
- oblique_card: "Look closely at the most embarrassing details and amplify them"
- started_at: 2026-07-30T14:22:00Z
- completed_at: 2026-07-30T14:31:00Z

## Problem echoed
How should Exigo build an autonomous UX design/review loop that owns the visual/interaction layer despite the repo having no browser automation and no visual-regression tooling?

## Seed reframe echoed
The card told me to stop designing a review tool and instead design a *shame detector*: the loop's core output is not a score but an undeniable inventory of things the team already knows are wrong and keeps working around.

## Embarrassing details actually observed (via `ls`, paths cited)
- 20 committed PNGs at repo root, not 16 (`/arena-mid.png`, `/arena-v2.png`, `/arena-v3.png`, `/arena-v4.png`, `/calltree.png`, `/plot-v2.png`, `/pmr-arena-migrated.png`, `/presets-migrated.png`, `/settings-page.png`, …).
- Sizes swing 11KB→461KB (`/arena-v4.png` 11KB vs `/generate-success.png` 139KB) — the tiny ones are plausibly blank/broken renders nobody checked.
- `/src/app/tests/` — a test route with its own `page.tsx` shipping inside the product app.
- `/test-backend-limits.mjs`, `/test-sync.mjs` — ad-hoc test scripts dumped at repo root.
- No `.gitignore` entry caught any of these; they were committed on purpose.

## Inherited constraints echoed
- none (cycle-001)

## Ideas

### I-001-031: Shame Ledger — the loop's primary artifact is a diff of admissions, not a score
- Description: Instead of emitting a UX grade, the loop maintains `agents/ux-review/archive/shame-ledger.jsonl`: one row per detected embarrassment (orphan asset, dead route, token drift, missing empty-state) with `first_seen`, `still_present`, `worked_around_at`. A review "passes" only when the ledger shrinks. This directly formalizes the fossil-record workflow the PNGs already prove exists — the team iterates and forgets to clean up.
- Failure mode it prevents: A perceptual loop that hallucinates praise it cannot verify (§4.3 rubber-stamp risk) — a ledger of concrete artifacts cannot be faked.
- Why it's novel: Reframes the output from quality-judgment to debt-inventory, sidestepping the perceptual half entirely.
- Riskiest assumption: That every UX problem worth catching leaves a source-visible fossil; purely perceptual flaws (bad hierarchy on a clean screen) leave none and slip through.
- Warrant: I counted 20 committed root PNGs and a `src/app/tests` route — real, undeniable, source-visible debt the team never cleaned.
- Parent idea: (none)

### I-001-032: Orphan-Asset Sentinel — grep the tree for referenced vs. loose images
- Description: A γ-wave mechanical check that lists every image committed to the repo, greps `src/` for references to each, and flags the unreferenced ones (all 20 root PNGs qualify). Output names each orphan and its byte size, and quarantines suspiciously tiny renders as "probably broken." This is the smallest deployable slice of the whole loop and needs zero browser.
- Failure mode it prevents: The exact `arena-v2→v3→v4` clutter accumulating unbounded because nobody has a mechanical sweep.
- Why it's novel: Treats screenshots-as-fossils as a *lint target*, not documentation.
- Riskiest assumption: That "unreferenced in `src/`" equals "safe to flag" — some PNGs may be referenced from READMEs, docs, or `agents/` prompts and would be false-flagged.
- Warrant: All 20 PNGs sit at root, none under `public/`, so a reference grep is trivially runnable today.
- Parent idea: (none)

### I-001-033: Render-Manifest instead of live screenshots (kills the fake-eyes temptation)
- Description: Because the loop has no eyes (§4.2 fact 1), forbid it from claiming a screenshot ever. Instead it emits a *render manifest*: for each route it lists the components rendered, the design tokens resolved, and the loading/empty/error branches present in source. Reviewers read the manifest, not an image. Lives at `agents/ux-review/` mirroring `cd-review`'s source-only stance.
- Failure mode it prevents: A worker asserting `arena-v4.png looks good` when the 11KB file is actually a blank crash.
- Why it's novel: Makes the no-eyes constraint a *contract* — the loop is structurally unable to lie about pixels it never saw.
- Riskiest assumption: That a source-derived manifest carries enough signal to catch real UX defects; it will miss anything that only manifests at runtime (overlap, overflow, z-index).
- Warrant: The mismatched PNG sizes prove eyeballing already produced unverified artifacts — a manifest removes the pixel-claim it cannot back.
- Parent idea: (none)

### I-001-034: Dead-Route Audit — `src/app/tests` as the canonical smell
- Description: An α-wave check that enumerates `src/app/*` route segments and flags any that are dev/test/debug surfaces reachable in the product build (`tests/`, `sso-callback` if orphaned). Each flagged route becomes a shame-ledger row until deleted or gated. Names the exact directory it touches.
- Failure mode it prevents: Shipping an internal `tests` page to production users — a legibility and trust failure.
- Why it's novel: Extends UX review to *route surface hygiene*, not just per-screen pixels.
- Riskiest assumption: That `src/app/tests` is truly shipped and not already excluded by middleware/config I was told not to read.
- Warrant: `src/app/tests/` exists with its own `page.tsx` — I saw the directory.
- Parent idea: (none)

### I-001-035: Adversarial "prove-you-saw-it" gate on every ADVANCE verdict
- Description: No review verdict may say ADVANCE unless it cites a concrete source-level artifact (file path + line, token name, or manifest entry). Verdicts lacking a citation auto-downgrade to REJECT. A skeptic sub-check re-reads each ADVANCE and deletes the citation-less ones. Structural anti-sycophancy per §4.4 (no model diversity, no human).
- Failure mode it prevents: The rubber-stamp failure §4.3 warns is the likeliest outcome of an autonomous UX loop.
- Why it's novel: Inverts the burden of proof — silence defaults to rejection, not approval.
- Riskiest assumption: That a determined worker can't fabricate a plausible-looking citation to satisfy the gate cheaply.
- Warrant: The brief itself names rubber-stamping/hallucination as the primary honesty risk (§4.3).
- Parent idea: (none)

### I-001-036: Pre-mortem seeding — start each cycle from the worked-around list
- Description: Before generating any review, the loop reads the shame-ledger's `worked_around_at` rows and asks "which of these did we route around instead of fix?" A workaround (e.g. `-migrated` suffix, a duplicated component) is treated as a confession that the original was unusable. These become the cycle's priority targets, so debt the team is quietest about surfaces first.
- Failure mode it prevents: The loop happily reviewing polished screens while systemic rot (duplicated `presets-migrated` flows) stays invisible.
- Why it's novel: Uses *workarounds as evidence of embarrassment*, per the card, rather than treating them as neutral history.
- Riskiest assumption: That a `-migrated`/`v4` suffix reliably signals shame rather than healthy, intentional iteration.
- Warrant: `presets-migrated.png` and `pmr-arena-migrated.png` are literal committed evidence of migration-by-eyeball.
- Parent idea: (none)

## Self-report
- Ideas generated: 6
- Ideas discarded as too vague: 1 ("make the loop score aesthetics 1–10" — no source-visible warrant, pure perception, discarded per mandate)
- Ideas skipped as duplicate of novelty archive: 0 (empty archive)
- Constraint violations caught and corrected: 1 (an early draft proposed "a designer reviews the manifest" — cut per §4.4 no-human-in-worker)
