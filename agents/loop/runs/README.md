# runs/ — per-cycle run artifacts

Each subdirectory is one cycle run, named `YYYY-MM-DD-CNNN` where `CNNN` is the zero-padded cycle counter (resets only on a user-declared "new session").

```text
runs/
  YYYY-MM-DD-CNNN/
    RECORD.md                       ← cycle narrative + Stopped at + Residual + verdicts
    cycle-scope.md                  ← launcher-written brief (goal, problem, stop conditions)
    day-status.json                 ← thin launcher poll file (state, phase, tokens_used)
    persona-seed-matrix.md          ← diversification matrix for this cycle
    brainstorm/
      B-001-dreamer-s1.md           ← per-subagent idea-doc
      ... (10 total per scout cycle)
    research/
      R-001-I-001.md                ← per-idea Toulmin dossier (3-state verdict)
      ... (5 total per scout cycle)
      R-006-I-NNN.md                ← (optional) capped DA re-dispatch
      _summary.md                   ← orchestrator's β-consolidation summary
    synthesis/
      S-001-claims.md               ← γ-1 output: verified/refuted/inconclusive claims by theme
      S-002-constraints.md          ← γ-2 output: next-cycle constraints (Delphi+Stepladder)
    citations/
      verified.jsonl                ← per-cycle verified citations (merged to archive at end)
      refuted.jsonl                 ← per-cycle refuted citations (merged to archive at end)
    checkpoints/
      alpha-B-001.json              ← per-subagent durable-progress checkpoint
      ...
```

## Immutability

Per `../LOOP.md` §1.5 (invariant rule #7), prior `runs/YYYY-MM-DD-CNNN/` folders are immutable history. Only create new ones. Do NOT delete prior cycle folders — they are the audit trail.

## How to find the latest run

```bash
ls -d agents/loop/runs/*/ | sort | tail -1
```

Or read `agents/loop/archive/cycles.json` and look at the last entry in `cycles[]`.

## How to resume a stopped cycle

Read `agents/loop/runs/<latest>/RECORD.md` and `agents/loop/runs/<latest>/day-status.json`. The `Stopped at` field in RECORD.md + `phase` + `last_checkpoint` in day-status.json tell the launcher exactly what work remains. See `../LOOP.md` §8.2 (resume protocol).
