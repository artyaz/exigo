# Wave β — 3-state composition verdict

**Run:** `2026-07-30-L001-composed-cdreview-brainstorm-join`  
**Executed by:** orchestrator solo, using the canonical 3-state verdict from
`agents/loop-compose/LOOP.md` ("3-state composition verdict (canonical)").

## Decision procedure (applied in this order, per the canonical spec)

1. **Type-match** — does the output port have a type-compatible adapter to the
   input port? If no → `ORTHOGONAL`.
2. **Resource-collision** — do the two loops claim overlapping external
   side-effects? If yes → `CONFLICT`.
3. **Default** → `COMPOSE`.

### The type lattice (explicit, so the verdict is auditable)

| Output type | Input type | Adapter | Note |
|-------------|-----------|---------|------|
| *T* | *T* | `identity` | same type binds trivially |
| `markdown-file(s)` | `text` | `digest` | markdown *is* text |
| `git-diff` | `text` | `diff_digest` | a unified diff *is* text |
| `json-file` | `jsonl` | `wrap_single` | one object is a 1-line JSONL doc |
| `markdown-file(s)` | `jsonl` | `extract_records` | lossy but well-defined |
| `github-pr-url` | *any* | **none** | needs a network fetch; no adapter exists under the sealed-canary constraints the ship-gate itself imposes |

The lattice is deliberately **permissive**. Narrowing the type layer to
manufacture a convenient answer would hide the real work, so type-compatibility
stays mechanical and a *separate* semantic-admissibility annotation records why
a type-compatible edge may still be left unbound. The semantic column never
changes a verdict — it only decides what the contract binds.

### The CONFLICT class found here

The two founder loops have disjoint run-root prefixes
(`agents/cd-review/<date>/` vs `agents/brainstorm/runs/<...>/`) and disjoint
`loop_id` namespaces, so there is no directory or namespace collision. The live
collision is the **resume contract**: both parents export a `record-port` and a
`day-status-port`. A composed loop has exactly one orchestrator writing exactly
one `RECORD.md` and one `day-status.json`, so treating a parent's
record/status file as *composable data* is a single-writer collision on the one
artifact C-001-can-04 makes load-bearing.

All 8 CONFLICT verdicts are this single class.

### CONFLICT resolution (required before ship)

CONFLICT class is entirely the resume-contract single-writer collision (record-port / day-status-port). Resolution per loop-compose LOOP.md ('rename: loop_b gets a different loop_id namespace'): the composed loop takes its OWN loop_id namespace and declares ONE record-port + ONE day-status-port at its own run root, plus its OWN last_step_vocabulary (C-001-004a). No parent status/record file is bound as data. Refuse-to-ship is therefore not triggered.

## Verdicts

### COMPOSE (16)

| Dir | From (port / type) | To (port / type) | Adapter | Verdict | Semantic class |
|-----|--------------------|------------------|---------|---------|----------------|
| `A->B` | `fixes-port`<br>`git-diff` | `problem-statement-port`<br>`text` | `diff_digest` | **COMPOSE** | ADMISSIBLE-SECONDARY |
| `A->B` | `audit-port`<br>`markdown-files` | `problem-statement-port`<br>`text` | `digest` | **COMPOSE** | ADMISSIBLE-PRIMARY |
| `A->B` | `audit-port`<br>`markdown-files` | `prior-constraints-port`<br>`jsonl` | `extract_records` | **COMPOSE** | UNCLASSIFIED |
| `A->B` | `audit-port`<br>`markdown-files` | `novelty-archive-port`<br>`jsonl` | `extract_records` | **COMPOSE** | UNCLASSIFIED |
| `A->B` | `brainstorms-port`<br>`markdown-files` | `problem-statement-port`<br>`text` | `digest` | **COMPOSE** | INADMISSIBLE-DEGENERATE |
| `A->B` | `brainstorms-port`<br>`markdown-files` | `prior-constraints-port`<br>`jsonl` | `extract_records` | **COMPOSE** | UNCLASSIFIED |
| `A->B` | `brainstorms-port`<br>`markdown-files` | `novelty-archive-port`<br>`jsonl` | `extract_records` | **COMPOSE** | UNCLASSIFIED |
| `B->A` | `ideas-port`<br>`markdown-files` | `slice-map-port`<br>`text` | `digest` | **COMPOSE** | INADMISSIBLE-UNVERIFIED |
| `B->A` | `ideas-port`<br>`markdown-files` | `prior-fixes-port`<br>`jsonl` | `extract_records` | **COMPOSE** | UNCLASSIFIED |
| `B->A` | `dossiers-port`<br>`markdown-files` | `slice-map-port`<br>`text` | `digest` | **COMPOSE** | ADMISSIBLE-SECONDARY |
| `B->A` | `dossiers-port`<br>`markdown-files` | `prior-fixes-port`<br>`jsonl` | `extract_records` | **COMPOSE** | UNCLASSIFIED |
| `B->A` | `claims-port`<br>`markdown-file` | `slice-map-port`<br>`text` | `digest` | **COMPOSE** | ADMISSIBLE-SECONDARY |
| `B->A` | `claims-port`<br>`markdown-file` | `prior-fixes-port`<br>`jsonl` | `extract_records` | **COMPOSE** | UNCLASSIFIED |
| `B->A` | `constraints-port`<br>`markdown-file` | `slice-map-port`<br>`text` | `digest` | **COMPOSE** | ADMISSIBLE-PRIMARY |
| `B->A` | `constraints-port`<br>`markdown-file` | `prior-fixes-port`<br>`jsonl` | `extract_records` | **COMPOSE** | UNCLASSIFIED |
| `B->A` | `citations-port`<br>`jsonl` | `prior-fixes-port`<br>`jsonl` | `identity` | **COMPOSE** | INADMISSIBLE-TYPE-COINCIDENCE |

### CONFLICT (8)

| Dir | From (port / type) | To (port / type) | Adapter | Verdict | Semantic class |
|-----|--------------------|------------------|---------|---------|----------------|
| `A->B` | `record-port`<br>`markdown-file` | `problem-statement-port`<br>`text` | `digest` | **CONFLICT** | UNCLASSIFIED |
| `A->B` | `record-port`<br>`markdown-file` | `prior-constraints-port`<br>`jsonl` | `extract_records` | **CONFLICT** | UNCLASSIFIED |
| `A->B` | `record-port`<br>`markdown-file` | `novelty-archive-port`<br>`jsonl` | `extract_records` | **CONFLICT** | UNCLASSIFIED |
| `A->B` | `day-status-port`<br>`json-file` | `prior-constraints-port`<br>`jsonl` | `wrap_single` | **CONFLICT** | UNCLASSIFIED |
| `A->B` | `day-status-port`<br>`json-file` | `novelty-archive-port`<br>`jsonl` | `wrap_single` | **CONFLICT** | UNCLASSIFIED |
| `B->A` | `record-port`<br>`markdown-file` | `slice-map-port`<br>`text` | `digest` | **CONFLICT** | UNCLASSIFIED |
| `B->A` | `record-port`<br>`markdown-file` | `prior-fixes-port`<br>`jsonl` | `extract_records` | **CONFLICT** | UNCLASSIFIED |
| `B->A` | `day-status-port`<br>`json-file` | `prior-fixes-port`<br>`jsonl` | `wrap_single` | **CONFLICT** | UNCLASSIFIED |

### ORTHOGONAL (21)

| Dir | From (port / type) | To (port / type) | Adapter | Verdict | Semantic class |
|-----|--------------------|------------------|---------|---------|----------------|
| `A->B` | `fixes-port`<br>`git-diff` | `prior-constraints-port`<br>`jsonl` | — | **ORTHOGONAL** | UNCLASSIFIED |
| `A->B` | `fixes-port`<br>`git-diff` | `novelty-archive-port`<br>`jsonl` | — | **ORTHOGONAL** | UNCLASSIFIED |
| `A->B` | `fixes-port`<br>`git-diff` | `cycle-type-port`<br>`enum` | — | **ORTHOGONAL** | UNCLASSIFIED |
| `A->B` | `pr-port`<br>`github-pr-url` | `problem-statement-port`<br>`text` | — | **ORTHOGONAL** | UNCLASSIFIED |
| `A->B` | `pr-port`<br>`github-pr-url` | `prior-constraints-port`<br>`jsonl` | — | **ORTHOGONAL** | UNCLASSIFIED |
| `A->B` | `pr-port`<br>`github-pr-url` | `novelty-archive-port`<br>`jsonl` | — | **ORTHOGONAL** | UNCLASSIFIED |
| `A->B` | `pr-port`<br>`github-pr-url` | `cycle-type-port`<br>`enum` | — | **ORTHOGONAL** | UNCLASSIFIED |
| `A->B` | `audit-port`<br>`markdown-files` | `cycle-type-port`<br>`enum` | — | **ORTHOGONAL** | UNCLASSIFIED |
| `A->B` | `brainstorms-port`<br>`markdown-files` | `cycle-type-port`<br>`enum` | — | **ORTHOGONAL** | UNCLASSIFIED |
| `A->B` | `record-port`<br>`markdown-file` | `cycle-type-port`<br>`enum` | — | **ORTHOGONAL** | UNCLASSIFIED |
| `A->B` | `day-status-port`<br>`json-file` | `problem-statement-port`<br>`text` | — | **ORTHOGONAL** | UNCLASSIFIED |
| `A->B` | `day-status-port`<br>`json-file` | `cycle-type-port`<br>`enum` | — | **ORTHOGONAL** | UNCLASSIFIED |
| `B->A` | `ideas-port`<br>`markdown-files` | `repo-port`<br>`directory-path` | — | **ORTHOGONAL** | UNCLASSIFIED |
| `B->A` | `dossiers-port`<br>`markdown-files` | `repo-port`<br>`directory-path` | — | **ORTHOGONAL** | UNCLASSIFIED |
| `B->A` | `claims-port`<br>`markdown-file` | `repo-port`<br>`directory-path` | — | **ORTHOGONAL** | UNCLASSIFIED |
| `B->A` | `constraints-port`<br>`markdown-file` | `repo-port`<br>`directory-path` | — | **ORTHOGONAL** | UNCLASSIFIED |
| `B->A` | `citations-port`<br>`jsonl` | `repo-port`<br>`directory-path` | — | **ORTHOGONAL** | UNCLASSIFIED |
| `B->A` | `citations-port`<br>`jsonl` | `slice-map-port`<br>`text` | — | **ORTHOGONAL** | UNCLASSIFIED |
| `B->A` | `record-port`<br>`markdown-file` | `repo-port`<br>`directory-path` | — | **ORTHOGONAL** | UNCLASSIFIED |
| `B->A` | `day-status-port`<br>`json-file` | `repo-port`<br>`directory-path` | — | **ORTHOGONAL** | UNCLASSIFIED |
| `B->A` | `day-status-port`<br>`json-file` | `slice-map-port`<br>`text` | — | **ORTHOGONAL** | UNCLASSIFIED |

## Semantic rationale for the classified edges

**`fixes-port → problem-statement-port`** — ADMISSIBLE-SECONDARY  
A shipped diff can be a problem statement ('what did this change miss?'), but it is a post-hoc review edge, not the improvement edge we need.

**`audit-port → problem-statement-port`** — ADMISSIBLE-PRIMARY  
Hostile audit findings are exactly the problem statement an improvement hypothesis should answer. This is the forward edge of the intent.

**`brainstorms-port → problem-statement-port`** — INADMISSIBLE-DEGENERATE  
cd-review Wave B already produces fix-ideas. Feeding them into brainstorm alpha to produce more ideas is the B-003 I-003-DELTA degenerate case: 'composition = one parent renamed with extra steps'.

**`ideas-port → slice-map-port`** — INADMISSIBLE-UNVERIFIED  
Wave alpha ideas are explicitly unverified. Letting them steer what gets audited would import brainstorm's divergence without its verification.

**`dossiers-port → slice-map-port`** — ADMISSIBLE-SECONDARY  
Dossiers could re-aim the slice map, but constraints-port is the purpose-built, already-consolidated form of the same signal.

**`claims-port → slice-map-port`** — ADMISSIBLE-SECONDARY  
Redundant with constraints-port, which is the decayed/prioritised form.

**`constraints-port → slice-map-port`** — ADMISSIBLE-PRIMARY  
Verified constraints from cycle N re-aim which slices/lenses cycle N+1 audits. This is the feedback edge that makes the composition a join rather than a one-shot pipe.

**`citations-port → prior-fixes-port`** — INADMISSIBLE-TYPE-COINCIDENCE  
Both are jsonl so the type layer binds them, but a citation record is not a fix record. Binding would corrupt cd-review's idempotency check.

## Bound edges (what the contract actually wires)

- **PRIMARY** `A->B:audit-port->problem-statement-port`
- **PRIMARY** `B->A:constraints-port->slice-map-port`

Secondary-admissible edges are recorded but left unbound this cycle to keep the
composed loop's dataflow single-purpose; they are listed in the contract's
`deferred_bindings` for a future cycle.

**Verdict: PROCEED to Wave γ** — 16 COMPOSE edges exist, 5 are semantically
admissible, and the CONFLICT class has a resolution that does not require
refuse-to-ship. The novelty-decay stop condition (0 COMPOSE verdicts) is not
triggered.

