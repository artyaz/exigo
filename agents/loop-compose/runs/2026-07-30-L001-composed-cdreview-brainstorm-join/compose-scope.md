# Compose scope — 2026-07-30-L001

Launcher-written brief. Read-only for the composition-scope agent.

## Inputs (loop-compose `ports:`)

| Port | Value |
|------|-------|
| `loop-a-port` | `agents/cd-review/` |
| `loop-b-port` | `agents/brainstorm/` |
| `composition-contract-port` | seed contract below; finalised by β into `../composition-contract.md` |

## Goal (goal-anchored stop condition)

Author **one** composed loop that covers **code review, optimization and
improvement** as a single autonomous protocol, and ship it through the ε
canary. Stop when 1 composed loop passes ε.

## Why this pair

The user asked for a loop that does code review **and** optimization **and**
improvement. Those are three different verbs and no existing loop covers all
three:

- `cd-review` reviews and fixes, but its Wave B design step is **unverified**
  (Decision Packages carry "Approaches considered" with no external grounding,
  no citations, no 3-state verdict) and nothing in the protocol **measures**
  whether a shipped fix improved anything. Its gates are correctness gates
  (`npm run check`, `npm run test`) and taste gates (Wave D lenses).
- `brainstorm` produces externally-verified Toulmin dossiers with
  ADVANCE/REFUTE/INCONCLUSIVE verdicts and a citation cache, but it has **no
  repo-write port and no PR port** — it ships zero code.

So the pair is complementary in exactly the dimension the request names:
`cd-review` can ship but cannot prove; `brainstorm` can prove but cannot ship.

## Seed composition contract (pre-α)

```yaml
loop_a: agents/cd-review/
loop_b: agents/brainstorm/
intent: >
  A loop that reviews the codebase, forms improvement hypotheses, verifies them
  against external evidence, measures their effect before and after, and ships
  only the ones that are both verified and measured.
operator: TBD-by-alpha        # one of: parallel ⊕, sequential ∘, adversarial ⊗, join-on-archive ⋈
binding: TBD-by-alpha         # enumerated in alpha/, verdicted in beta/
delta_test: TBD-by-gamma
```

## Stop conditions for this run

- **Goal-anchored:** 1 composed loop passes the ε canary → `scope_complete`.
- **Novelty-decay:** if α yields 0 COMPOSE verdicts, terminate
  `stop_reason="all-pairs-orthogonal-or-conflict"`.
- **Budget:** per-cycle 380k kill-switch; `MAX_NEW_LOOPS_PER_SESSION=10`
  (this run creates 1).
- **Blast radius:** this run writes outside `$RUN_ROOT` only to create the
  composed loop's own directory, append one line to the composition manifest,
  and append one entry to the inter-loop catalog. `MAX_OPEN_PRS=1`.

## Hard rules

- NO HUMAN IN THE LOOP. Do not pause for "should I continue?".
- `no_parent_mutation`: `agents/cd-review/LOOP.md` and
  `agents/brainstorm/LOOP.md` are **read-only** for this run.
- ε canary spec MUST be drawn from the fixed trivial-domain corpus
  (C-001-004b), not tailored to the composed loop's capabilities.
