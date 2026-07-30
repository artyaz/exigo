# Composition contract — `cdreview-brainstorm-join`

Seeded by the launcher in [`compose-scope.md`](./compose-scope.md), finalised by
Wave β. This is the `composition-contract-port` value for this run.

```yaml
loop_a: agents/cd-review/
loop_b: agents/brainstorm/
composed_loop_id: cdreview-brainstorm-join
composed_dir: agents/cdreview-brainstorm-join/
operator: join_on_archive        # ⋈  — see "Why join, not pipe" below

binding:
  # ---- forward edge (PRIMARY) -------------------------------------------
  - from: cd-review.outputs.audit-port
    to: brainstorm.inputs.problem-statement-port
    adapter: digest
    role: forward
    note: >
      Wave A's P0–P3 findings, clustered, become the problem statement that the
      hypothesis wave must answer. This is the edge that gives brainstorm's
      verification machinery something real to verify.

  # ---- feedback edge (PRIMARY) -----------------------------------------
  - from: brainstorm.outputs.constraints-port
    to: cd-review.inputs.slice-map-port
    adapter: digest
    role: feedback
    note: >
      Cycle N's MUST_RESPECT / MUST_AVOID / MUST_TEST constraints re-aim which
      slices and which lenses cycle N+1 audits. Without this edge the
      composition is a one-shot pipe; with it, the loop learns where to look.

deferred_bindings:
  # COMPOSE + semantically admissible, but left unbound this cycle to keep the
  # dataflow single-purpose. Candidates for a future cycle.
  - {from: cd-review.outputs.fixes-port, to: brainstorm.inputs.problem-statement-port, class: ADMISSIBLE-SECONDARY}
  - {from: brainstorm.outputs.dossiers-port, to: cd-review.inputs.slice-map-port, class: ADMISSIBLE-SECONDARY}
  - {from: brainstorm.outputs.claims-port, to: cd-review.inputs.slice-map-port, class: ADMISSIBLE-SECONDARY}

refused_bindings:
  - {edge: cd-review.brainstorms-port -> brainstorm.problem-statement-port,
     reason: "B-003 I-003-DELTA degenerate case — cd-review Wave B already makes fix-ideas"}
  - {edge: brainstorm.citations-port -> cd-review.prior-fixes-port,
     reason: "jsonl/jsonl type coincidence; a citation is not a fix record"}
  - {edge: brainstorm.ideas-port -> cd-review.slice-map-port,
     reason: "unverified alpha ideas must not steer what gets audited"}

conflict_resolution:
  class: resume-contract-single-writer
  count: 8
  resolution: >
    The composed loop takes its own loop_id namespace and declares exactly one
    record-port and one day-status-port at its own run root, plus its own
    last_step_vocabulary (C-001-004a). No parent status or record file is bound
    as data. Refuse-to-ship is not triggered.

delta_test:
  property: >
    Every shipped diff carries (a) an ADVANCE-verdict dossier with at least one
    verified citation and (b) a before/after measurement on a metric declared
    BEFORE the fix was written — and a REFUTE verdict blocks the ship even when
    the fix is already written, green, and lens-approved.
  baseline_a: >
    Run cd-review alone. It audits, brainstorms fixes, fixes, lens-reviews and
    ships. Its Wave B decision packages carry no external grounding, no
    citations and no 3-state verdict, and nothing in the protocol measures
    whether the shipped fix improved anything.
  baseline_b: >
    Run brainstorm alone. It produces ADVANCE/REFUTE/INCONCLUSIVE dossiers with
    a verified-citation cache, but exposes no repo-write port and no PR port, so
    it ships zero code and measures nothing.
  pass_criterion: >
    The composed loop emits the full artifact union {audit finding, verified
    dossier, before-measurement, after-measurement, measured delta, shipped
    diff, refutation veto record}. Each baseline must be structurally incapable
    of emitting at least one member of that union. Composed must strictly beat
    both.
```

## Why `join`, not `pipe`

A sequential pipe `cd-review ∘ brainstorm` would be the **degenerate**
composition the delta-test exists to reject. `cd-review` already contains a
brainstorm wave (Wave B, §6), so piping its audit output into another
brainstorm produces "cd-review with a fancier Wave B" — one parent renamed.

What makes this pair worth composing is not the forward edge on its own, it is
the **join on a shared, persistent evidence archive**:

- the forward edge gives brainstorm's verification machinery a real target;
- a new measurement archive records the before/after effect of every shipped
  change, which **neither parent has in any form**;
- the feedback edge lets verified constraints re-aim the next audit;
- the archive is what makes the gate *conjunctive over time* — a claim refuted
  in cycle 3 stays refuted in cycle 9 without re-deriving it.

So the operator is `join_on_archive ⋈`, with the forward pipe embedded inside
the join.

## Specification of the composed interface

This is the contract δ must implement. Wave ε re-runs the γ delta-test against
the **authored** `LOOP.md` and compares it to this block, which catches the
failure mode "δ authored something weaker than γ admitted".

```yaml
loop_id: cdreview-brainstorm-join
parent_loops: [cd-review, brainstorm]
mutation_operator: compose
composed_by: loop-compose
composed_operator: join_on_archive
remaining_extraction_depth: 2

ports:
  inputs:
    - {name: repo-port, type: directory-path, required: true}
    - {name: improvement-goal-port, type: text, required: true}
    - {name: slice-map-port, type: text, required: false}
    - {name: prior-constraints-port, type: jsonl, required: false}
    - {name: prior-measurements-port, type: jsonl, required: false}
    - {name: verified-improvements-port, type: jsonl, required: false}
    - {name: novelty-archive-port, type: jsonl, required: false}
    - {name: cycle-type-port, type: enum, required: false}
  outputs:
    - {name: audit-port, type: markdown-files}
    - {name: hypotheses-port, type: markdown-files}
    - {name: dossiers-port, type: markdown-files}
    - {name: measurements-port, type: jsonl}
    - {name: refutations-port, type: jsonl}
    - {name: verified-improvements-port, type: jsonl}
    - {name: constraints-port, type: markdown-file}
    - {name: citations-port, type: jsonl}
    - {name: fixes-port, type: git-diff}
    - {name: pr-port, type: github-pr-url}
    - {name: record-port, type: markdown-file}
    - {name: day-status-port, type: json-file}
```

`verified-improvements-port` appears as **both** an input and an output — that
is the join: cycle N reads what earlier cycles proved, and appends what it
proves. It is the mechanism behind stare decisis.

### Required wave table

| Wave | Job | Inherited from | Must produce |
|------|-----|----------------|--------------|
| **A** — Audit | Hostile slice audit, findings only | `cd-review` Wave A | findings with `Severity: P0\|P1\|P2\|P3`, code:line citation, and a declared metric when measurable |
| **H** — Hypothesise | Improvement hypotheses, persona × seed diversified | `brainstorm` Wave α | one hypothesis doc per finding-cluster |
| **V** — Verify | Toulmin dossier + 3-state verdict | `brainstorm` Wave β | `ADVANCE / REFUTE / INCONCLUSIVE` per hypothesis, ≥1 citation verified against the 7-day TTL cache |
| **M** — Measure | Metric capture, twice | **new — neither parent** | `M-<id>-before.json` before any edit, `M-<id>-after.json` after, and a `delta_computed` call of `improved\|neutral\|regressed` |
| **F** — Fix | Surgical edits, ADVANCE only | `cd-review` Wave C | product diff + fix report |
| **D** — Review | 4 inherited lenses + mandatory Evidence lens L6 | `cd-review` §7.5 | per-lens review + consolidated verdict |
| **G** — Evidence Gate | Conjunctive admission | **new — neither parent** | gate verdict; on veto a `ship_blocked` record in `refutations-port` |
| **S** — Synthesise + ship | Constraints, then ship | `brainstorm` Wave γ + `cd-review` §10.2 | next-cycle constraints, then `gh pr create` → `develop_merged` → `main_merged` |

### Required `last_step_vocabulary` (excerpt — δ declares the full list)

```
init, cycle_scope_written, slice_map_resolved, wave_a_dispatched, wave_a_collected,
findings_clustered, wave_h_dispatched, wave_h_collected, hypothesis_shortlist_written,
wave_v_dispatched, wave_v_collected, citation_verify,
verdict_recorded:{HYP_ID}:{advance|refute|inconclusive},
measure_before:{HYP_ID}, wave_f_dispatched:{PACK_ID}, verify_done:{PACK_ID},
measure_after:{PACK_ID}, delta_computed:{PACK_ID}:{improved|neutral|regressed},
wave_d_dispatched:{PACK_ID}:round_{N}, wave_d_verdict:{PACK_ID}:{...},
evidence_gate:{PACK_ID}:{pass|veto}, ship_blocked:{PACK_ID}:{reason},
develop_pushed, develop_merged:{PR}, main_merged:{PR},
constraints_written, archive_update_complete, record_finalized, scope_complete
```

## Constraint set

Wave δ pairs **each section** of the authored `LOOP.md` with **exactly one**
constraint from this list (loop-forge §10.1 rule 1: constraint-orphan sections
are dropped).

| ID | Type | Constraint |
|----|------|-----------|
| C-J-001 | MUST_RESPECT | The composed `LOOP.md` header carries a typed `ports:` block, `remaining_extraction_depth`, and its own `last_step_vocabulary` (C-001-can-02, C-001-can-03, C-001-004a). |
| C-J-002 | MUST_RESPECT | Exactly one writer owns `RECORD.md` and `day-status.json`, at the composed loop's own run root. Parent status/record files are never bound as data. (Wave β CONFLICT resolution.) |
| C-J-003 | MUST_RESPECT | CLI peer layer is optional; single-agent mode is the mandatory baseline. No human in the loop inside the cycle-scope agent. |
| C-J-004 | MUST_RESPECT | Cycle init resolves the slice map from the prior cycle's constraints archive before dispatching Wave A (the feedback edge is load-bearing, not decorative). |
| C-J-005 | MUST_RESPECT | "Optimization" means *measured*. An unmeasured change is a fix, not an optimization, and may not be recorded as one. |
| C-J-006 | MUST_RESPECT | Strict one-directional wave separation with disjoint ownership: A finds, H proposes, V verifies, M measures, F edits, D reviews, S synthesises and ships. No wave does another wave's job. |
| C-J-007 | MUST_RESPECT | The slice map is an input port, defaulted from `cd-review`'s S1–S11, re-aimable by constraints — never hardcoded in the protocol body. |
| C-J-008 | MUST_RESPECT | Wave A writes findings only, and every finding must declare whether it is *measurable* and by what metric. Non-measurable findings are still shippable but cannot claim an optimization. |
| C-J-009 | MUST_RESPECT | Wave H subagents each hold a disjoint (persona, seed) tuple. Structural diversity pressure is required, not advisory. |
| C-J-010 | MUST_RESPECT | Wave V issues a 3-state verdict per hypothesis and requires ≥1 citation verified within the cache TTL. No hypothesis ships without ADVANCE. |
| C-J-011 | MUST_RESPECT | The before-measurement is recorded and committed to disk **before** any product code is edited. A before-measurement taken after the fix is a protocol violation. |
| C-J-012 | MUST_AVOID | Wave F must not implement REFUTE or INCONCLUSIVE hypotheses, and must not widen scope beyond the dossier's declared change surface. |
| C-J-013 | MUST_RESPECT | Wave D runs the four inherited lenses plus a mandatory Evidence lens (L6) that can veto on its own. |
| C-J-014 | MUST_RESPECT | The Evidence Gate is conjunctive: ADVANCE ∧ verified-citation ∧ measured-delta-not-regressed ∧ L6-pass. A REFUTE vetoes a diff that is already written, green and lens-approved. |
| C-J-015 | MUST_RESPECT | Wave S writes the next cycle's constraints **before** the ship step, so a crash during ship cannot lose the learning. |
| C-J-016 | MUST_RESPECT | `day-status.json` uses the cd-review §0.5.4 *shape* (C-001-can-04) with this loop's own step names, and is written before every side effect. |
| C-J-017 | MUST_RESPECT | Four archives persist across cycles: verified improvements, measurements, novelty, constraints. Mid-cycle writes to `archive/` are forbidden. |
| C-J-018 | MUST_RESPECT | The 8 invariant rules of autonomy are restated in adapted form; removing any one ends autonomy. |
| C-J-019 | MUST_RESPECT | Stop conditions have three layers: goal-anchored, novelty-decay, budget-anchored — plus a blast-radius kill-switch. |
| C-J-020 | MUST_RESPECT | A conventions table fixes verdict vocabulary, IDs, run-ID format and budgets. |
| C-J-021 | MUST_RESPECT | A Lineage block ends the file, enforcing `no_self_composition` and `no_parent_mutation`. |
| C-J-022 | MUST_TEST | The measurement layer's honesty is the loop's weakest point: a subagent could pick a metric that trivially improves. L6 must check metric relevance, not just metric presence. Promote to MUST_RESPECT once a cycle demonstrates a caught bad-metric case. |
| C-J-023 | MUST_RESPECT | The `LOOP.md` carries a History table recording its own provenance — who authored it, from which parents, under which operator, with which verdicts. A loop that cannot say where it came from cannot be audited. |

### Section ↔ constraint pairing (δ must satisfy this)

Every section of the authored `LOOP.md` maps to exactly one constraint above,
and every constraint above maps to at least one section. Sections with no paired
constraint are dropped (loop-forge §10.1 rule 1).

| Constraint | Owns section |
|-----------|--------------|
| C-J-001 | header `ports:` block |
| C-J-002 | §0 Directory layout — single-writer resume contract |
| C-J-003 | §0.5 Harness |
| C-J-004 | §1 Starting a cycle |
| C-J-005 | §2 North-star and non-goals |
| C-J-006 | §3 Architecture |
| C-J-007 | §4 Slice aim |
| C-J-008 | §5 Wave A — Audit |
| C-J-009 | §6 Wave H — Hypothesise |
| C-J-010 | §7 Wave V — Verify |
| C-J-011 | §8 Wave M — Measure |
| C-J-012 | §9 Wave F — Fix |
| C-J-013 | §10 Wave D — Pre-PR review |
| C-J-014 | §11 Wave G — Evidence Gate |
| C-J-015 | §12 Wave S — Synthesise, then ship |
| C-J-016 | §13 Record and resume contract |
| C-J-017 | §14 Archives |
| C-J-018 | §15 The 8 invariant rules of autonomy |
| C-J-019 | §16 Stop conditions |
| C-J-020 | §17 Conventions |
| C-J-021 | §18 Lineage |
| C-J-022 | §19 Open risk |
| C-J-023 | §20 History |
