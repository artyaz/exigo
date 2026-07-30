# L6 — Evidence & measurement integrity (reviewer brief)

The Wave D lens catalogue for `cdreview-brainstorm-join`. Lenses **L1–L4** (and
optional **L5**) are inherited unchanged from
[`agents/cd-review/REVIEW-LENS.md`](../cd-review/REVIEW-LENS.md) — correctness &
security, readability, repo consistency, tests & edge cases, optional UI/a11y.

This file specifies the **one new lens**, and it is the only lens that can veto
on its own.

## Why L6 exists

L1–L4 read the diff and ask *"is this good code?"* None of them can ask *"is
this the change the evidence justified, and did it actually help?"* — because
none of them are shown the dossier or the measurements.

L6 is the reviewer that holds all three artifacts at once: **the claim, the
diff, and the numbers.** It is the loop's defence against its own most
attractive failure mode — shipping a change that is clean, green, lens-approved,
and unjustified.

## Inputs (L6 sees strictly more than L1–L4)

| Artifact | Path |
|----------|------|
| the staged diff | `git diff develop...HEAD -- <change_surface>` |
| the dossier | `$RUN_ROOT/dossiers/V-<NNN>-<hyp_id>.md` |
| the hypothesis | `$RUN_ROOT/hypotheses/H-<NNN>-*.md` |
| before measurement | `$RUN_ROOT/measure/M-<hyp_id>-before.json` |
| after measurement | `$RUN_ROOT/measure/M-<hyp_id>-after.json` |
| computed delta | `$RUN_ROOT/measure/measurements.jsonl` |
| the fix report | `$RUN_ROOT/audits/fixes/<PACK_ID>.md` |
| repo conventions | `AGENTS.md`, `.coderabbit.yaml` |

L6 does **not** see the other lenses' output (lens independence is inherited
from `cd-review` REVIEW-LENS.md §1).

## The six checks

### 1. Traceability — every hunk earns its place

Walk the diff hunk by hunk. For each, name the sentence in the dossier's `claim`
or `grounds` that justifies it.

- Hunk with no justifying sentence → **P1** `unexplained_hunk`.
- Hunk that is pure drive-by tidying → **P2** (`fix_and_proceed` is fine; it just
  should not be silently bundled into a measured optimization).

### 2. Surface — the change stayed inside its bounds

Compare touched paths against the dossier's `change_surface`.

- Any file outside the declared surface → **P1** `surface_exceeded`. The metric
  was declared against that surface, so exceeding it invalidates the
  measurement, not just the paperwork.

### 3. Metric relevance — the honest-metric check

**This is the most important check in the lens** and the one C-J-022 flags as the
loop's weakest point (`LOOP.md` §19).

Ask: *could this metric have moved for a reason unrelated to the claim?*

Concrete gaming patterns to look for:

| Pattern | Example | Verdict |
|---------|---------|---------|
| Denominator gaming | `coverage_pct` rose because a large untested file was deleted, not because tests were added | **P1** `metric_irrelevant` |
| Comment stripping | `loc_touched_surface` fell because comments were removed | **P1** `metric_irrelevant` |
| Trivial-test padding | `coverage_pct` rose via tests asserting a getter returns its field | **P1** `metric_irrelevant` |
| Surface displacement | `max_function_loc` fell because a 90-line function moved to a file outside the surface | **P1** `metric_displaced` |
| Noise harvesting | `wall_seconds` "improved" by less than run-to-run variance | **P1** `metric_within_noise` |
| Direction confusion | `direction` declared `higher_is_better` for a metric where lower is plainly better | **P0** `metric_direction_wrong` |

A `not-measurable` finding shipping as a plain **fix** is *correct behaviour*
(`LOOP.md` §2) — do not flag it. Flag the opposite: a fix wearing an
optimization's clothes.

### 4. Ordering — the baseline predates the edit

Check `M-<hyp>-before.json`'s `git_sha` is an ancestor of the diff's base.

- Not an ancestor, or `git_sha: "unknown"` → **P0** `baseline_after_edit`. This
  is the one protocol violation that cannot be repaired by editing the diff; the
  pack must be re-run from a clean tree.
- A `.r2.json` re-measure with no `remeasure_reason` → **P1**
  `undocumented_remeasure`.

### 5. Label honesty — the vocabulary rule

Read the fix report and the draft PR body against `LOOP.md` §2:

| Word used | Requires | If missing |
|-----------|----------|------------|
| "fix" | finding + green check/test | — |
| "improvement" | + ADVANCE dossier with ≥1 verified citation | **P1** `mislabelled_improvement` |
| "optimization" | + measured `improved` | **P1** `mislabelled_optimization` |

A `neutral` delta described as a speedup is a **P1**, not a rounding error.

### 6. Citation integrity

For each citation in the dossier's `backing`:

- Does the URL exist and did it return 200 within the 7-day TTL?
- Does the quoted line actually appear at that URL?
- Does it support *this* claim, or merely a general principle? For anything
  touching Exigo-specific architecture, `LOOP.md` §7.3 requires at least one
  in-repo `path:line` ground — external-only backing is **P1**
  `no_inrepo_grounds`.
- A dossier whose `qualifier` was capped at 0.50 by non-200 citations may still
  ADVANCE, but note the cap in the summary so the gate report records it.

## Output format

Write to `$RUN_ROOT/audits/pre-pr/{PACK_ID}-lens6.md`:

```text
# Wave D review — {PACK_ID} — lens 6 (Evidence & measurement integrity)

## Summary
2–4 sentences. State plainly whether the evidence justifies the diff.

## Artifacts read
- dossier: V-... (verdict, qualifier)
- measurements: before=<v> after=<v> delta=<call>
- change_surface declared / touched

## Findings
### D-{PACK_ID}-L6-{nnn}: {title}
- Severity: P0|P1|P2|P3
- Check: traceability|surface|metric_relevance|ordering|label_honesty|citation_integrity
- Location: path:lines OR artifact:field
- Evidence:
- Why it breaks the evidence chain:
- Required remedy:

## Metric verdict
- Declared metric: {name} ({direction}, {unit})
- Does it test the claim? YES | NO — reasoning
- Could it move for unrelated reasons? YES | NO — reasoning
- Within noise? YES | NO (threshold = 2 × stdev = {value})

## Clean bill justification (only if zero P0/P1/P2)
Name each of the six checks and why it passed.

## Top 3 (for orchestrator)
```

## Veto authority

Any **L6 finding at P1 or above forces `send_back_to_wave_F`**, regardless of
what L1–L4 concluded (`LOOP.md` §10.1). L6 findings are also a gate conjunct in
their own right: `no_l6_p1` in `bin/gate.py`.

A clean bill from L6 must name all six checks. "Looks fine" is not a clean bill —
it is a missing review, and the orchestrator should re-dispatch the lens.

## What L6 is NOT

- Not a code-quality review — that is L1–L4.
- Not a re-verification of the claim — Wave V owns that. L6 checks the
  *evidence chain is intact*, not that the science is right.
- Not a re-measurement — Wave M owns that. L6 checks the measurement was taken
  in the right order, on a relevant metric, and reported honestly.
- Not allowed to spawn children.
