# Moved

The codebase review loop lives at:

**[`agents/cd-review/LOOP.md`](../agents/cd-review/LOOP.md)**

Dated run artifacts (audits, brainstorms, RECORD):

**`agents/cd-review/YYYY-MM-DD/`**

Current run: [`agents/cd-review/2026-07-18/`](../agents/cd-review/2026-07-18/)

## Headless entry point

To run the loop autonomously in a sealed environment (no human in the
loop), invoke:

```bash
scripts/cb-review-autonomous.sh                 # today, fresh or resume
scripts/cb-review-autonomous.sh --resume        # latest dated run
scripts/cb-review-autonomous.sh --date 2026-07-24
scripts/cb-review-autonomous.sh --scope wave14 --max-runtime 43200
```

The script detects the harness (CLI peer vs single-agent), writes a mode
marker to `$RUN_ROOT/audits/harness-mode.json`, and spawns / re-wakes the
day-scope agent until the loop reaches a terminal state. See
`agents/cd-review/LOOP.md` §0.5 and §10.5.

## Wave D (pre-PR review)

Before opening a PR, the orchestrator fans out 4 parallel subagent
reviewers (correctness/security, readability, consistency, tests) per
pack. Lens catalogue and reviewer brief: 
[`agents/cd-review/REVIEW-LENS.md`](../agents/cd-review/REVIEW-LENS.md).

See `LOOP.md` §7.5 for the acceptance gate and round cap.
