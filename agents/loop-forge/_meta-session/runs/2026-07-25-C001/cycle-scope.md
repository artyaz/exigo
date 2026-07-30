# loop-forge — Cycle-Scope Brief — 2026-07-25-C001

## Goal this cycle

Design a **loop that creates other loops** (the meta-loop, `loop-forge`). The
meta-loop's own `LOOP.md` is the cycle's ship target.

## One-sentence problem statement

What is the universal protocol an agent follows to **author a new autonomous
loop** for an arbitrary domain — where the agent itself decides what
"autonomy" means in that domain, where the resulting loop is combinable with
other existing loops, and where the agent may extract a sub-loop mid-task if
doing so improves quality?

## Context

- Exigo already has two loops following the same two-layer harness pattern:
  `agents/cd-review/LOOP.md` (critical / convergent) and
  `agents/brainstorm/LOOP.md` (divergent / idea-generation). Both share:
  launcher + cycle-scope agent, RECORD.md + day-status.json resume contract,
  strict wave separation, single source of truth at `LOOP.md`, immutable run
  folders, archive/ as cross-cycle memory, multi-layered stop conditions,
  no-HITL inside the worker.
- A **skill** is a static capability description the agent loads on demand. A
  **loop** is an autonomy envelope: an agent runs the loop end-to-end with no
  human in the loop, makes its own decisions, spawns subagents to discuss and
  pressure-test those decisions, finds flaws in its own work, ships artifacts,
  and waits for / responds to external signals (CI, code review comments, etc.).
- The meta-loop must be **universal**: not bound to GitHub, research, lesson
  writing, or any one domain. The agent running the meta-loop determines the
  autonomy criteria applicable to the target loop's domain (e.g., for GitHub:
  PR creation, comment response, CI monitoring; for research: literature
  search, citation verification, claim triangulation; for lesson writing:
  source gathering, factual review, pedagogical critique).
- The meta-loop must be **combinable**: e.g., `loop-forge` + `brainstorm` → a
  new loop that creates loops via divergent brainstorming. Composition is a
  first-class operation, not an afterthought.
- **Mid-task loop extraction:** if during execution the agent determines that
  some sub-problem (e.g. "how to determine the autonomy criteria for an
  unknown domain") would produce higher-quality work as its own dedicated
  loop, the agent MUST extract that sub-loop, write its `LOOP.md`, and
  register it for future reuse — not inline its logic.

## Inherited constraints (from prior cycles)

None — this is the inaugural cycle of the meta-loop-design brainstorm.

## Stop conditions

- **Goal-anchored:** stop when the cycle has produced ≥ 3 ADVANCE-verdicted
  ideas with confidence ≥ 0.7 covering the dimensions (autonomy envelope,
  domain reconnaissance, decision-making under self-critique, composition,
  mid-task extraction), AND a draft `LOOP.md` has been written for
  `agents/loop-forge/LOOP.md` embodying those ideas.
- **Novelty-decay:** 3 consecutive cycles with 0 new ADVANCE ideas (n/a for
  cycle-001).
- **Budget-anchored:** hard kill-switch 380k tokens; target 350k.

## Out of scope

- Implementation of the meta-loop's first concrete run (that is a future
  cycle, by the loop itself once authored).
- A second model. Single-model shop — anti-sycophancy is structural
  (different persona, different rubric, different temperature), not
  model-based.
- Re-litigating the brainstorm workflow's protocol (this cycle uses it as
  given).
- Domain-specific autonomy logic. The meta-loop must NOT hard-code GitHub /
  research / lesson-writing rules. It must instruct the running agent to
  discover them.

## Success shape

A draft `agents/loop-forge/LOOP.md` that:
1. Specifies the two-layer launcher + cycle-scope harness (consistent with
   existing exigo loops).
2. Specifies the **domain reconnaissance wave** — how the agent autonomously
   determines what autonomy means in the target domain (no human briefing).
3. Specifies the **decision-making wave** — how the agent makes design
   decisions and spawns adversarial subagents to find flaws in those
   decisions (steelman / pre-mortem / falsification, mirroring brainstorm's
   structural anti-sycophancy).
4. Specifies the **authoring wave** — how the agent writes the new loop's
   `LOOP.md`, README.md, archive/, runs/ skeleton.
5. Specifies the **mid-task extraction protocol** — when and how the agent
   decides a sub-problem warrants its own loop, and how that extracted loop
   is registered for future reuse.
6. Specifies the **composition protocol** — how two existing loops are
   composed into a new loop (e.g., `loop-forge ⊕ brainstorm`).
7. Specifies the cross-cycle archive (loop registry, autonomy-criteria
   archive, extracted-loops archive).
8. Specifies the 8 invariant rules of autonomy (adapted from brainstorm
   §8.6) — and the multi-layer stop conditions (§8.5).
9. Is universal — domain-agnostic in its canonical text, with the agent
   filling in domain specifics at run time.

## Cycle type

Scout (350k target / 380k kill-switch).

## Hard budget

HARD_BUDGET_TOKENS=380000
