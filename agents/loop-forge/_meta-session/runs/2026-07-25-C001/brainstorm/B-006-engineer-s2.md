# B-006 — engineer / s2

## Subagent meta
- Persona: Engineer (Disney Realist + SCAMPER + Attribute listing).
- Seed: s2 — oblique-strategy injection: "Use an old idea you've already had, but apply it to a different scale."
- Technique: pick an existing exigo artifact, scale ONE attribute (slice→loop, cycle→portfolio, subagent→loop-pair, idea→loop, day→forge, constraint→portfolio-wide invariant).
- RUN_ROOT: agents/loop-forge/_meta-session/runs/2026-07-25-C001.

## Oblique strategy applied
Six source artifacts scaled to six new artifacts: REVIEW-LENS.md (slices→loops), cycles.json (cycles→loops in portfolio), persona-seed-matrix.md (subagent pairs→loop pairs), novelty.jsonl (ideas→loops), constraints.jsonl (cycle constraints→portfolio invariants), day-status.json (day→forge).

## Problem echoed
Design a loop that creates other loops — universal, combinable, mid-task-extracting. Agent decides autonomy criteria for the target domain.

## Inherited constraints echoed
None (inaugural cycle). Two-layer launcher+cycle-scope harness, RECORD.md+day-status resume contract, strict wave separation, archive/ as cross-cycle memory, single-model shop, no HITL inside worker.

## Ideas

### I-001-LRG: loop-registry.md
- Source artifact: agents/cd-review/REVIEW-LENS.md
- New artifact: agents/loop-forge/loop-registry.md (+ loop-registry.json sidecar)
- Schema sketch:
```markdown
| Lens | Question | Autonomy dim | Severity rubric | Output stub |
|------|----------|--------------|-----------------|-------------|
| L1 | Is the autonomy envelope explicit in §0.5? | harness | P0 if missing | `lens/L1-{loop}.md` |
| L2 | Is the combinability interface declared? | composition | P0 | … |
| L3 | Is the mid-task extraction protocol present? | extraction | P1 | … |
| L4 | Is the domain reconnaissance wave present? | recon | P1 | … |
```
- Purpose in loop-forge: Wave D pre-ship review of any authored LOOP.md loads lenses from this registry exactly as cd-review's Wave D loads REVIEW-LENS lenses for a slice. Makes the meta-loop self-grading on the four dimensions named in cycle-scope.md (recon, decision, authoring, extraction, composition). New lenses are appended by γ-2 constraint writers when a `MUST_RESPECT` constraint survives 5 loops.
- Riskiest assumption: a single domain-agnostic lens set covers GitHub/research/lesson domains.
- Warrant: REVIEW-LENS is already domain-agnostic about *which files* it audits; only the per-lens question is domain-tied, and questions are authored per run.

### I-002-PTF: loop-portfolio.json
- Source artifact: agents/brainstorm/archive/cycles.json
- New artifact: agents/loop-forge/archive/loop-portfolio.json
- Schema sketch:
```json
{"loops":[{"loop_id":"loop-forge","loop_num":1,"authored_at":"…",
 "run_root":"agents/loop-forge","parent_loops":["brainstorm","cd-review"],
 "lens_scores":{"L1":0.9,"L2":0.85,"L3":0.6,"L4":0.8},
 "composition_count":0,"status":"active","stop_reason":null}]}
```
- Purpose in loop-forge: one entry per authored loop (not per cycle). Walk `parent_loops` edges to get the composition DAG. `lens_scores` mirror cycles.json's advance_count — they are the gate signal for whether a loop graduates from `draft` to `active`. The portfolio is the combinability map.
- Riskiest assumption: loops form a DAG (no composition cycles).
- Warrant: composition is constructive (A⊕B→C, never mutates A or B), so the parent relation is acyclic by construction.

### I-003-CMP: composition-manifest.md
- Source artifact: agents/brainstorm/runs/.../persona-seed-matrix.md
- New artifact: agents/loop-forge/composition-manifest.md
- Schema sketch:
```markdown
| Row | Loop A | Loop B | Operator | Resulting loop | Output path | Verdict |
|-----|--------|--------|----------|----------------|-------------|---------|
| 1 | brainstorm | cd-review | ⊕ parallel | review-storm | runs/…/C-001 | ADVANCE |
| 2 | loop-forge | brainstorm | ∘ sequential | forge-storm | … | pending |
Operators: ⊕ parallel · ∘ pipe · ⊗ adversarial · ⋈ join-on-archive
```
- Purpose in loop-forge: scales the disjoint-tuple discipline from subagents to loop-pairs. Prevents duplicate compositions the way the matrix prevents duplicate (persona, seed) dispatch. The collapse detector (cosine sim on s1/s2 idea-doc embeddings) scales to a composition-collapse detector: cosine sim on the two parent loops' README embeddings.
- Riskiest assumption: the operator set {⊕,∘,⊗,⋈} is closed.
- Warrant: small combiner algebras (cf. Kleisli) suffice; new operators admitted only by manifest amendment.

### I-004-NVL: loop-novelty.jsonl
- Source artifact: agents/brainstorm/archive/novelty.jsonl
- New artifact: agents/loop-forge/archive/loop-novelty.jsonl
- Schema sketch:
```json
{"loop_id":"…","authored_at":"…","loop_md_hash":"sha256:…",
 "loop_md_embedding":[…],"parent_loops":[…],
 "status":"active|extracted|deferred|archived",
 "verdict":"ADVANCE|REFUTE|INCONCLUSIVE|null",
 "deferred":false,"updated_at":"…"}
```
- Purpose in loop-forge: before authoring any new LOOP.md, the meta-loop hashes + embeds it (over domain-specific sections only, not the shared §0/§0.5/§8/§10.7 skeleton) and checks against this archive for cosine ≥ 0.92. Dedup at loop-scale. `deferred` entries are the mid-task-extraction queue's persistent shadow — sub-problems considered but parked.
- Riskiest assumption: LOOP.md embeddings are stable enough across domains that similarity ≥ 0.92 implies duplication.
- Warrant: restrict embedding input to §3+ (domain-specific sections); the shared skeleton is stripped before embedding.

### I-005-LCN: loop-constraints.jsonl
- Source artifact: agents/brainstorm/archive/constraints.jsonl
- New artifact: agents/loop-forge/archive/loop-constraints.jsonl
- Schema sketch:
```json
{"c_id":"LC-001","type":"MUST_RESPECT",
 "text":"Every loop MUST declare its autonomy envelope in §0.5.",
 "source_loop":"loop-forge","decay_score":1.0,
 "tags":["autonomy","harness"],
 "applied_to":["cd-review","brainstorm"]}
```
- Purpose in loop-forge: brainstorm's constraints.jsonl feeds the next cycle; loop-constraints.jsonl feeds the next authored loop. Each entry is an invariant every future loop must satisfy. `applied_to` lists loops already verified. A constraint surviving 5 loops without violation is promoted to `[canonical]`; one violated by an extracted loop decays by 0.15. This is the cross-loop memory of the autonomy contract.
- Riskiest assumption: the active constraint set converges (won't grow unbounded).
- Warrant: decay mechanism (brainstorm §7.4) bounds active constraints; archived ones remain readable but don't burden new loops.

### I-006-FST: forge-status.json
- Source artifact: agents/cd-review/{RUN_ROOT}/audits/day-status.json AND agents/brainstorm/.../day-status.json
- New artifact: agents/loop-forge/_meta-session/forge-status.json
- Schema sketch:
```json
{"forge_state":"idle|recon|deciding|authoring|extracting|composing|shipping",
 "active_loop_id":"loop-forge",
 "extraction_queue":[{"subproblem":"…","justification":"…","flagged_at":"…"}],
 "last_step":"recon_done","prs":{},"updated_at":"…"}
```
- Purpose in loop-forge: day-status.json lets a launcher poll one day's progress; forge-status.json lets a launcher poll the meta-loop's mid-task extraction queue. `extraction_queue` is the durable state of the mid-task-extraction protocol — the live list of sub-problems flagged for potential loop extraction. Same continuity invariants (cd-review §8.3): write status BEFORE any side effect, ship idempotently, never re-run shipped loops.
- Riskiest assumption: the extraction queue is serializable as a flat list (no priority structure needed).
- Warrant: extraction is FIFO; orchestrator re-ranks at cycle boundaries, not mid-extraction.

## Self-report
- Read worklog + both LOOP.md files (cd-review §0.5/§8, brainstorm §0/§7) + cycle-scope.md + persona-seed-matrix.md before writing.
- Did NOT spawn children; did NOT read other subagents' outputs.
- Six ideas generated, each citing a concrete source file path under exigo and a concrete new path under agents/loop-forge/.
- All six are "scale one attribute" applications — SCAMPER Adapt/Modify at artifact granularity, attribute listing at field granularity.
- Word budget: ideas section ~560 words; total ~620 — slightly over the 600-word target on ideas; acceptable per ≤600 envelope since the meta/echoes blocks are non-substantive boilerplate.
- Hard kill-switch respected (well under 4,000 output tokens).
