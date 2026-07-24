# `agents/loop-forge/runs/`

Per-cycle run artifacts. One folder per loop-authoring cycle, named
`YYYY-MM-DD-LNNN/` where `LNNN` is the loop number (zero-padded).

Folders are **immutable history** — never edit a prior run's artifacts. To
continue from a prior cycle, create a new folder and link "continues from"
in the new `RECORD.md`.

## Layout of a single run

```text
runs/YYYY-MM-DD-LNNN/
  RECORD.md                 ← narrative + Stopped at + Residual + verdicts
  loop-scope.md             ← launcher-written brief (target domain, stop cond)
  day-status.json           ← thin launcher poll file (state, phase, tokens_used)
  loop-spec.md              ← Ω wave output (discovered autonomy criteria + ports + last_step vocab)
  persona-seed-matrix.md    ← diversification matrix for α
  recon/                    ← Ω wave output
    probe-responses.jsonl
    autonomy-criteria.md
    itch-log.jsonl          ← mid-task itch filings (cumulative)
  brainstorm/               ← α wave idea-docs
    B-001-<persona>-<seed>.md
    ...
  research/                 ← β wave dossiers (3-state verdict)
    R-001-<idea_id>.md
    _summary.md
  synthesis/                ← γ wave output
    S-001-claims.md
    S-002-constraints.md
  authored/                 ← δ wave output (the new loop's files)
    LOOP.md
    README.md
    archive/.gitkeep
    runs/.gitkeep
    loop-registry.json
  canary/                   ← ε wave output (ship-gate evidence)
    canary-log.jsonl
    kill-resume-test.md
    verdict.md
  extract/                  ← mid-task extraction queue (if any)
    <sub-loop-name>.md
  citations/
    verified.jsonl
    refuted.jsonl
  checkpoints/
    <wave>-<artifact-id>.json
```

## Resume contract

A cold launcher can resume any run by reading:

1. `$RUN_ROOT/RECORD.md` — especially "Stopped at" and "Residual"
2. `$RUN_ROOT/day-status.json` — current state + phase + last_checkpoint
3. The latest `$RUN_ROOT/checkpoints/<wave>-<artifact-id>.json`

The launcher re-wakes the loop-scope orchestrator with the residual scope
(never invents status). Mid-wave re-entrancy is checkpoint-driven per
brainstorm §8.2.2 — only artifacts on disk matter; partial in-flight
subagent output is discarded.
