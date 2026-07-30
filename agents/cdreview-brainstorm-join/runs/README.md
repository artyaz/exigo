# Runs — immutable per-cycle artifacts

One directory per cycle: `YYYY-MM-DD-JNNN/`. **J** for *join*, which
disambiguates this loop's runs from `cd-review`'s bare dates, `brainstorm`'s
`C` cycles and `loop-forge`'s `L` runs.

Run folders are **immutable history**. Never delete or rewrite a prior run; a
correction is a new run that references the old one.

## Layout

See `LOOP.md` §0 for the authoritative tree. The shape in brief:

```text
YYYY-MM-DD-JNNN/
  RECORD.md          ← the cycle narrative. ONE writer: the orchestrator.
  cycle-scope.md     ← launcher brief (read-only in-cycle)
  day-status.json    ← THE status file. ONE writer. Shape per cd-review §0.5.4.
  slice-aim.md       ← which slices this cycle audits, and why (§4)
  persona-seed-matrix.md
  audits/    slices/ · clusters.md · verify-*.md · pre-pr/* · fixes/*
  hypotheses/        ← H-<NNN>-<persona>-<seed>.md
  dossiers/          ← V-<NNN>-<hyp_id>.md  (3-state verdict)
  measure/           ← M-<hyp>-before.json · M-<hyp>-after.json · measurements.jsonl
  gate/              ← gate-<PACK>.md · refutations.jsonl
  synthesis/         ← S-001-claims.md · S-002-constraints.md
  citations/         ← verified.jsonl · refuted.jsonl
  checkpoints/       ← <wave>-<artifact_id>.json
```

## The two files a launcher reads

A launcher (or a cold resume) reads **only** `day-status.json` and `RECORD.md`
"Stopped at". It never ingests the worker's transcript (`LOOP.md` §15.2). Those
two files plus `checkpoints/<latest>.json` are the entire resume contract.

## Resuming

1. Read `day-status.json` → `last_step`, `state`, `resume_hint`.
2. Match `last_step` against the `last_step_vocabulary` in the `LOOP.md` header.
3. Skip completed work: `audits/fixes/<PACK>.md` with `Status: done`, and any
   Wave A/H/V output file that already exists non-empty (`LOOP.md` §13.2.3).
4. **Check the measurement invariant.** If `last_step` is at or past
   `wave_f_dispatched` and no `M-<hyp>-before.json` exists, the
   measure-before-mutate invariant was broken — veto the pack rather than
   guessing a baseline (`LOOP.md` §8.1).
5. Re-derive the gate with `bin/gate.py` rather than trusting a remembered
   verdict (`LOOP.md` §13.2.7).

## Measurements are immutable

`M-*-before.json` is never rewritten. A re-measure writes `M-*-before.r2.json`
with a `remeasure_reason`; `bin/measure.py` enforces this. An undocumented
re-measure is an L6 **P1** finding.
