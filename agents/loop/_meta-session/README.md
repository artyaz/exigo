# _meta-session/ — design rationale for the brainstorming loop

This directory contains the artifacts of the **meta-brainstorming session** that designed `agents/loop/LOOP.md` before writing it. The user asked: "before you proceed, do same session as I described for a loop with subagents to reach better goals" — so the loop design itself was produced by running a small version of the loop.

## What's here

The meta-session ran 4 phases (brainstorm → research → brainstorm → research), with **10 parallel subagents** across the phases:

### Phase 1 Brainstorm (5 parallel subagents)

- `phase-1-brainstorm/1-A-ai-brainstorming-methods.md` — AI/LLM brainstorming techniques (Tree of Thoughts, ReAct, Reflexion, multi-agent debate, persona-based generation, etc.). 50+ cited URLs.
- `phase-1-brainstorm/1-B-human-brainstorming-methods.md` — human brainstorming/CPS methods (Osborn-Parnes, SCAMPER, Six Hats, TRIZ, Disney, brainwriting, NGT, Delphi, etc.). 50+ cited URLs.
- `phase-1-brainstorm/1-C-subagent-coordination-patterns.md` — multi-agent coordination patterns (orchestrator-worker, map-reduce, debate, ensemble, blackboard, stigmergy, etc.). 70+ sources.
- `phase-1-brainstorm/1-D-cb-review-autonomy-extraction.md` — read `agents/cd-review/LOOP.md` in full and extracted the autonomy patterns to reuse (14 items + 7 invariant rules).
- `phase-1-brainstorm/1-E-verification-and-research-methods.md` — AI verification/research methods (ReAct, CoVe, Self-RAG, Toulmin, pre-mortem, etc.). 50+ sources.

### Phase 1 Research (2 parallel subagents)

- `phase-1-research/2-A-claim-verification.md` — verified 18 load-bearing Phase 1 claims against primary sources. 15/18 confirmed, 1 refuted, 6 corrections needed.
- `phase-1-research/2-B-contradictions-gaps-premortem.md` — devil's advocate pass: 10 contradictions between Phase 1 files, 13 coverage gaps, 16-row pre-mortem, 7 must-address gaps.

### Phase 2 Brainstorm (3 parallel subagents)

- `phase-2-brainstorm/3-A-outer-loop-architecture.md` — outer-loop architecture (launcher + cycle-scope orchestrator + 3 waves + cost budget + stop conditions). Resolved all 7 must-address gaps.
- `phase-2-brainstorm/3-B-brainstorm-wave-protocol.md` — Wave α (brainstorm) in detail: 5 personas × 2 seeds, subagent brief, output format, consolidation, diversity pressure.
- `phase-2-brainstorm/3-C-research-and-synthesis-protocol.md` — Wave β (research) + Wave γ (synthesis) in detail: Toulmin dossier, 3-state verdict, citation pipeline, anti-sycophancy, constraint format.

### Phase 2 Research (1 subagent)

- `phase-2-research/4-A-integrated-stress-test.md` — integrated stress test of the Phase 2 design. Found 5 critical bugs that were fixed before writing LOOP.md, plus 10 smaller issues.

## Total stats

- ~5,200 lines of design rationale
- ~300 cited primary sources (papers, engineering blogs, arXiv preprints)
- 10 subagents across 4 phases (5 + 2 + 3 + 1 = 11 subagent invocations, but 10 unique because 4-A was the final stress-test)
- All Phase 1 + Phase 2 outputs are preserved here for audit and future iteration

## Why keep this in the repo?

1. **Auditability** — every design decision in `LOOP.md` traces back to a specific finding here. If a future maintainer asks "why persona×seed and not just N=10 random samples?", the answer is in `1-A` (Deng & Brucks 2026 finding, verified by `2-A`).
2. **Iterability** — when the loop needs to be revised (e.g., add a second model for the Judge role, switch from embedding-based dedup to LLM-based clustering), the design space has already been mapped. A future meta-session can start from these artifacts rather than from scratch.
3. **Honesty** — the design rationale shows where the loop is strong and where it accepted tradeoffs (e.g., single-model-shop anti-sycophancy is weaker than multi-model; the 350k scout cycle budget forces a reduced protocol per idea). Future maintainers should know what was traded away.

## How to navigate

Start with `phase-2-research/4-A-integrated-stress-test.md` — it's the executive summary of the integrated design and the 5 bugs that were fixed before shipping. Then read `phase-2-brainstorm/3-A-outer-loop-architecture.md` for the canonical architecture. The Phase 1 files are reference material for specific design questions.

## Relationship to `LOOP.md`

`LOOP.md` is the **canonical protocol** the cycle-scope orchestrator reads at spawn time. The files in this directory are **design rationale** — they explain *why* `LOOP.md` is the way it is, but they are NOT read by the orchestrator and have no runtime role. If `LOOP.md` and a `_meta-session/` file disagree, `LOOP.md` wins.
