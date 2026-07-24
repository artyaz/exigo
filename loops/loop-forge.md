# Loop Forge

A loop that creates loops. Lives at:

**[`agents/loop-forge/LOOP.md`](../agents/loop-forge/LOOP.md)**

Wave D (pre-PR review of the produced loop) lens catalogue:

**[`agents/loop-forge/REVIEW-LENS.md`](../agents/loop-forge/REVIEW-LENS.md)**

Dated run artifacts (discover findings, design packages, drafts,
pre-PR reviews, self-extend logs, RECORD):

**`agents/loop-forge/YYYY-MM-DD/`**

## Headless entry point

To run the loop autonomously in a sealed environment (no human in the
loop), invoke:

```bash
scripts/loop-forge-autonomous.sh                          # today, fresh or resume
scripts/loop-forge-autonomous.sh --resume                 # latest dated run
scripts/loop-forge-autonomous.sh --date 2026-07-25
scripts/loop-forge-autonomous.sh --scope "loop-forge:research-survey" --max-runtime 43200
```

The script detects the harness (CLI peer vs single-agent), writes a
mode marker to `$RUN_ROOT/audits/harness-mode.json`, and spawns /
re-wakes the day-scope agent until the loop reaches a terminal state.
See `agents/loop-forge/LOOP.md` §0.5 and §10.5.

## What this loop produces

For each run, `loop-forge` ships **one or more new loops**, each
consisting of:

- `loops/<new-loop-name>.md` — pointer file (like this one)
- `agents/<new-loop-name>/LOOP.md` — source of truth
- `agents/<new-loop-name>/REVIEW-LENS.md` — Wave D lens catalogue (if
  the new loop has a pre-PR review stage)
- `scripts/<new-loop-name>-autonomous.sh` — headless entry point

Every produced loop inherits the operating contract from
`loop-forge`: long-running, self-driving, no human in the loop,
crash-safe resume, and a combineability contract (§11) plus an
autonomy checklist (§12) that make it chainable with other loops.

## Wave D (pre-PR review of the produced loop)

Before opening a PR for a new loop, the orchestrator fans out 4
parallel subagent reviewers (autonomy / combineability / universality
/ resilience) per draft. Lens catalogue and reviewer brief:
[`agents/loop-forge/REVIEW-LENS.md`](../agents/loop-forge/REVIEW-LENS.md).

See `LOOP.md` §7.5 for the acceptance gate and round cap.

## Wave E (self-extension)

If, mid-draft or mid-review, the orchestrator realises a sub-step of
the new loop is itself loop-shaped, it may spawn **one** nested
`loop-forge` run as a sibling. The sibling ships first, then the
parent loop's §11 contract is updated to chain to it. Strict handoff
contract: `LOOP.md` §7.6.2.

## Combineability

`loop-forge` is combineable by construction. See `LOOP.md` §13.2 for
the concrete composition patterns:

- **`loop-forge + brainstorming-loop → new loop`** — the brainstorming
  loop's Wave γ outputs (`synthesis/S-001-claims.md`,
  `S-002-constraints.md`) feed into `loop-forge` as a trigger brief +
  inherited design constraints. This is the flagship composition.
- **`loop-forge + cb-review → hardened new loop`** — for new loops
  that target the codebase, `cb-review` provides the ship protocol
  and Wave D review pattern.
- **`loop-forge + loop-forge → new loop library`** — Wave E recursion.
  A single run can spawn a sibling run mid-task.

The combineability contract every produced loop must declare
(`LOOP.md` §11) is what makes these compositions work without the
loops re-reading each other's source.
