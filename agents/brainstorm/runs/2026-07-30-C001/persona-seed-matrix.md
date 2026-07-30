# persona-seed-matrix — 2026-07-30-C001

Written **before** Wave α dispatch per `LOOP.md` §1.4. Checkpoint material for
mid-wave resume. Every subagent holds a **disjoint (persona, seed) tuple**
(invariant §8.6.8).

## Seed strategy

- **s1** = the problem statement, lightly reframed as "How might we…?"
- **s2** = cycle 1 mod 5 → **oblique-strategy injection** (§5.1). Each persona
  gets one card from Brian Eno & Peter Schmidt's *Oblique Strategies*.

## Matrix (N=10)

| Subagent | Persona | Seed | Reframe / card | Status |
|----------|---------|------|----------------|--------|
| B-001 | Dreamer | s1 | "How might we give Exigo a loop that owns how the product looks and feels?" | pending |
| B-002 | Dreamer | s2 | *Honour thy error as a hidden intention* | pending |
| B-003 | Skeptic | s1 | "How might we review UX autonomously without rubber-stamping?" | pending |
| B-004 | Skeptic | s2 | *Look closely at the most embarrassing details and amplify them* | pending |
| B-005 | Engineer | s1 | "How might we build this from patterns already in exigo?" | pending |
| B-006 | Engineer | s2 | *Discover the recipes you are using and abandon them* | pending |
| B-007 | Outsider | s1 | "How would a non-software discipline review a made thing?" | pending |
| B-008 | Outsider | s2 | *Remove specifics and convert to ambiguities* | pending |
| B-009 | Synthesizer | s1 | "Which two unrelated domains combine into one UX-loop mechanism?" | pending |
| B-010 | Synthesizer | s2 | *Only one element of each kind* | pending |

## Dispatch result

All 10 subagents returned. **65 ideas** harvested (7+7+6+6+7+7+7+7+7+4).
Schema-validation (§5.4 step 1): **10/10 pass** — meta block, problem echoed,
≥3 ideas each with description + riskiest assumption + warrant, self-report all
present. 0 rejected, 0 blacklisted.

**Protocol deviation to note:** every idea-doc overran the ≤600-word cap in
§5.2 (actual range 877–1,485 words). Schema validity is what §5.4 step 1 gates
on, so none were rejected, but the cap is either unrealistic for 5–7 ideas at
this field count or needs enforcement in the brief. Carried to γ-2 as a
candidate constraint.

## Collapse detection (§5.1)

Assessed by the orchestrator at α-consolidation. Judged on mechanism distinctness
between each persona's s1 and s2 output (no embedding model available in this
harness — assessment is the orchestrator's read, recorded as such rather than as
a cosine number the loop did not compute).

| Persona | s1↔s2 collapse | Note |
|---------|----------------|------|
| Dreamer | no | s2 went failure-centric per the card (error-museum, regret log, ugliness budget); distinct from s1's capability-centric set. Partial motif overlap: "fossil" appears in both (I-001-003 replay vs I-001-011 diff) with different mechanisms. |
| Skeptic | no | s2 grounded itself in embarrassments actually observed by `ls` (loose PNGs, `src/app/tests`); s1 was mechanism-first. Clear separation. |
| Engineer | no | s2 named and abandoned specific inherited conventions with `file:line` citations; s1 adapted them. The card did real work. |
| Outsider | **partial** | Both seeds used a blind-wine-tasting donor frame (I-001-066 blind flight scoring / I-001-071 blind sommelier). Mechanisms differ (scoring serialized screens vs. inferring purpose from a stripped serialization), so not a merge — but the motif recurred across seeds. Flagged for prompt-tuning: the s2 card should exclude donor domains already used at s1. |
| Synthesizer | no | s2 genuinely reduced (4 ideas, one-of-each-kind) against s1's 7 fan-out mechanisms. |

**Verdict: 0 personas collapsed; 1 partial motif overlap flagged (Outsider).**
Structural diversity pressure held for cycle-001.

## Clustering note (§5.4 step 3)

65 raw ideas → **12 clusters + 17 singletons**. Merge representative = the idea
with the most specific warrant, per §5.4 step 3.

The two largest clusters were:

- **Verdict-honesty (7 ideas)** — I-001-021, 022, 035, 045, 053, 083, 092, 005.
  Independent convergence across Skeptic/s1, Skeptic/s2, Engineer/s1,
  Engineer/s2, Synthesizer/s1, Synthesizer/s2 and Dreamer/s1 on the same
  conclusion: an eyeless reviewer must be *structurally* barred from asserting
  what it cannot evidence.
- **Baseline/fossil-as-oracle (7 ideas)** — I-001-081, 003, 011, 044, 026, 061,
  093, 074. Convergence on treating the 16 committed PNGs as a frozen record of
  a *past* human perception rather than as images to be looked at now.

**The most interesting non-convergence:** I-001-001 ("the loop installs
Playwright and grows its own eyes") was a **singleton**. Nine of ten personas
independently designed *around* the no-eyes constraint instead of proposing to
remove it. Wave β was therefore pointed at the designed-around mechanisms rather
than at the tooling question — but this asymmetry is itself a finding, and the
Skeptic's I-001-033 ("render-manifest *instead of* live screenshots, to kill the
fake-eyes temptation") argues the singleton is a trap rather than an oversight.

## Shortlist verdicts (written at α-consolidation, §5.4 step 6)

Shortlist K=5 by `0.4·novelty + 0.3·diversity + 0.2·specificity + 0.1·actionability`.

**Cold-start note:** `archive/novelty.jsonl` is empty, so `novelty = 1.0` for
every idea this cycle and ranking is effectively decided by diversity +
specificity + actionability. The score column below is therefore **not** a
novelty signal — recorded explicitly so a future cycle does not misread it.

Selection was additionally constrained to jointly cover the three axes the
`cycle-scope.md` §4.5 success shape requires: **(a)** where UX signal comes from
under the no-eyes constraint, **(b)** wave structure, **(c)** how verdicts stay
honest.

| Rank | Idea-id | Title (merge representative) | Persona / seed | Score | Axis | → |
|------|---------|------------------------------|----------------|-------|------|---|
| 1 | I-001-085 | Accessibility-transcript render as the loop's only honest eye | Synthesizer / s1 | 0.88 | a | R-001 |
| 2 | I-001-021 | Evidence-typed, non-summable verdicts (ADVANCE needs a quotable citation) | Skeptic / s1 | 0.86 | c | R-002 |
| 3 | I-001-081 | Golden-master fossil oracle: separation in time from a past human perception | Synthesizer / s1 | 0.84 | a | R-003 |
| 4 | I-001-047 | Design/review duality wave shape: audit → propose → gate, criteria pre-registered | Engineer / s1 | 0.80 | b | R-004 |
| 5 | I-001-071 | Blind-flight withheld-intent probe (discoverability from a stripped serialization) | Outsider / s2 | 0.77 | a | R-005 |

### Merge membership (what each shortlist slot carries into Wave β)

| Slot | Merged ideas |
|------|--------------|
| I-001-085 | 002 (ekphrasis / prose diff), 024 (a11y tree as substrate), 054 (SOURCE+DOM eyes, INCONCLUSIVE-by-default), 091 (single contact sheet via `renderToString`), 043 (state-completeness), 084 (state census) |
| I-001-021 | 022 (twin scorecards refuse to sum), 035 (prove-you-saw-it), 045 (citation-required), 092 (default-REJECT + quote the line), 083 (falsifiable-bet ledger), 005 (confess blindness), 053 (split by evidence class) |
| I-001-081 | 003 (fossil replay), 011 (fossil diff), 044 (PNG intake manifest), 026 (baseline-provenance lock), 061 (condition-report delta), 093 (pentimento HEAD~1↔HEAD diff), 074 (version stratigraphy) |
| I-001-047 | 057 (duality not pipeline), 007 (Muse vs Critic), 023 (pre-registered criteria frozen before fix), 025 (mandatory-defect adversary), 086 (red-team persona pair at different temperature), 094 (one-screen depth-over-breadth) |
| I-001-071 | 073 (stranger in unlabeled building), 076 (ethnographer, no phrasebook), 077 (redacted brief), 072 (Kim's Game recall), 066 (blind flight scoring), 075 (double-blind placebo screen), 062 (punch-list of promised affordances) |

### Nearest misses — preserved as `deferred` in `archive/novelty.jsonl`

I-001-001 (install Playwright / grow own eyes — the singleton; deferred as
contested, not rejected), I-001-041 (token-drift audit as a vitest suite — the
most immediately shippable mechanical check; deferred only because R-002 covers
the verdict-typing that governs it), I-001-032 (orphan-asset sentinel),
I-001-034 (dead-route audit of `src/app/tests`), I-001-051 (pair-slot
`before/`+`after/` RUN_ROOT), I-001-055 (perceptual constraints don't decay,
mechanical ones do), I-001-064 (certify under degraded conditions), I-001-067
(desire-path traces).
