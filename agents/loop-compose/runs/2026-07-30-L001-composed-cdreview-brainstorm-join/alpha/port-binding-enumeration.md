# Wave α — Pair enumeration

**Run:** `2026-07-30-L001-composed-cdreview-brainstorm-join`  
**Executed by:** orchestrator solo (per `agents/loop-compose/LOOP.md` §α)  
**Engine:** [`enumerate_bindings.py`](./enumerate_bindings.py) — parses the
`ports:` blocks out of the two parent `LOOP.md` files directly, so this table is
*computed from the real specs*, not asserted by hand. Re-run with:

```bash
python3 agents/loop-compose/runs/2026-07-30-L001-composed-cdreview-brainstorm-join/alpha/enumerate_bindings.py . \
        agents/loop-compose/runs/2026-07-30-L001-composed-cdreview-brainstorm-join
```

## Parents

| Role | Loop | Source | Inputs | Outputs |
|------|------|--------|--------|---------|
| A | `cd-review` | `./agents/cd-review/LOOP.md` | 3 | 6 |
| B | `brainstorm` | `./agents/brainstorm/LOOP.md` | 4 | 7 |

**A inputs:** `repo-port`, `slice-map-port`, `prior-fixes-port`  
**A outputs:** `fixes-port`, `pr-port`, `audit-port`, `brainstorms-port`, `record-port`, `day-status-port`  
**B inputs:** `problem-statement-port`, `prior-constraints-port`, `novelty-archive-port`, `cycle-type-port`  
**B outputs:** `ideas-port`, `dossiers-port`, `claims-port`, `constraints-port`, `citations-port`, `record-port`, `day-status-port`

## Candidate count

Both directions are enumerated because the intent ("review → improve → and then
review better next cycle") is a cycle, not a one-way pipe:

```
A→B : outputs(A) × inputs(B) = 6 × 4 = 24
B→A : outputs(B) × inputs(A) = 7 × 3 = 21
total                        = 45 candidate bindings
```

## Enumeration (all 45 candidates)

Verdicts in this table are the Wave β output, shown here so the enumeration and
its disposition can be read in one pass. The decision procedure is in
[`../beta/verdicts.md`](../beta/verdicts.md).

### A→B (`cd-review` output → `brainstorm` input)

| Dir | From (port / type) | To (port / type) | Adapter | Verdict | Semantic class |
|-----|--------------------|------------------|---------|---------|----------------|
| `A->B` | `fixes-port`<br>`git-diff` | `problem-statement-port`<br>`text` | `diff_digest` | **COMPOSE** | ADMISSIBLE-SECONDARY |
| `A->B` | `fixes-port`<br>`git-diff` | `prior-constraints-port`<br>`jsonl` | — | **ORTHOGONAL** | UNCLASSIFIED |
| `A->B` | `fixes-port`<br>`git-diff` | `novelty-archive-port`<br>`jsonl` | — | **ORTHOGONAL** | UNCLASSIFIED |
| `A->B` | `fixes-port`<br>`git-diff` | `cycle-type-port`<br>`enum` | — | **ORTHOGONAL** | UNCLASSIFIED |
| `A->B` | `pr-port`<br>`github-pr-url` | `problem-statement-port`<br>`text` | — | **ORTHOGONAL** | UNCLASSIFIED |
| `A->B` | `pr-port`<br>`github-pr-url` | `prior-constraints-port`<br>`jsonl` | — | **ORTHOGONAL** | UNCLASSIFIED |
| `A->B` | `pr-port`<br>`github-pr-url` | `novelty-archive-port`<br>`jsonl` | — | **ORTHOGONAL** | UNCLASSIFIED |
| `A->B` | `pr-port`<br>`github-pr-url` | `cycle-type-port`<br>`enum` | — | **ORTHOGONAL** | UNCLASSIFIED |
| `A->B` | `audit-port`<br>`markdown-files` | `problem-statement-port`<br>`text` | `digest` | **COMPOSE** | ADMISSIBLE-PRIMARY |
| `A->B` | `audit-port`<br>`markdown-files` | `prior-constraints-port`<br>`jsonl` | `extract_records` | **COMPOSE** | UNCLASSIFIED |
| `A->B` | `audit-port`<br>`markdown-files` | `novelty-archive-port`<br>`jsonl` | `extract_records` | **COMPOSE** | UNCLASSIFIED |
| `A->B` | `audit-port`<br>`markdown-files` | `cycle-type-port`<br>`enum` | — | **ORTHOGONAL** | UNCLASSIFIED |
| `A->B` | `brainstorms-port`<br>`markdown-files` | `problem-statement-port`<br>`text` | `digest` | **COMPOSE** | INADMISSIBLE-DEGENERATE |
| `A->B` | `brainstorms-port`<br>`markdown-files` | `prior-constraints-port`<br>`jsonl` | `extract_records` | **COMPOSE** | UNCLASSIFIED |
| `A->B` | `brainstorms-port`<br>`markdown-files` | `novelty-archive-port`<br>`jsonl` | `extract_records` | **COMPOSE** | UNCLASSIFIED |
| `A->B` | `brainstorms-port`<br>`markdown-files` | `cycle-type-port`<br>`enum` | — | **ORTHOGONAL** | UNCLASSIFIED |
| `A->B` | `record-port`<br>`markdown-file` | `problem-statement-port`<br>`text` | `digest` | **CONFLICT** | UNCLASSIFIED |
| `A->B` | `record-port`<br>`markdown-file` | `prior-constraints-port`<br>`jsonl` | `extract_records` | **CONFLICT** | UNCLASSIFIED |
| `A->B` | `record-port`<br>`markdown-file` | `novelty-archive-port`<br>`jsonl` | `extract_records` | **CONFLICT** | UNCLASSIFIED |
| `A->B` | `record-port`<br>`markdown-file` | `cycle-type-port`<br>`enum` | — | **ORTHOGONAL** | UNCLASSIFIED |
| `A->B` | `day-status-port`<br>`json-file` | `problem-statement-port`<br>`text` | — | **ORTHOGONAL** | UNCLASSIFIED |
| `A->B` | `day-status-port`<br>`json-file` | `prior-constraints-port`<br>`jsonl` | `wrap_single` | **CONFLICT** | UNCLASSIFIED |
| `A->B` | `day-status-port`<br>`json-file` | `novelty-archive-port`<br>`jsonl` | `wrap_single` | **CONFLICT** | UNCLASSIFIED |
| `A->B` | `day-status-port`<br>`json-file` | `cycle-type-port`<br>`enum` | — | **ORTHOGONAL** | UNCLASSIFIED |

### B→A (`brainstorm` output → `cd-review` input)

| Dir | From (port / type) | To (port / type) | Adapter | Verdict | Semantic class |
|-----|--------------------|------------------|---------|---------|----------------|
| `B->A` | `ideas-port`<br>`markdown-files` | `repo-port`<br>`directory-path` | — | **ORTHOGONAL** | UNCLASSIFIED |
| `B->A` | `ideas-port`<br>`markdown-files` | `slice-map-port`<br>`text` | `digest` | **COMPOSE** | INADMISSIBLE-UNVERIFIED |
| `B->A` | `ideas-port`<br>`markdown-files` | `prior-fixes-port`<br>`jsonl` | `extract_records` | **COMPOSE** | UNCLASSIFIED |
| `B->A` | `dossiers-port`<br>`markdown-files` | `repo-port`<br>`directory-path` | — | **ORTHOGONAL** | UNCLASSIFIED |
| `B->A` | `dossiers-port`<br>`markdown-files` | `slice-map-port`<br>`text` | `digest` | **COMPOSE** | ADMISSIBLE-SECONDARY |
| `B->A` | `dossiers-port`<br>`markdown-files` | `prior-fixes-port`<br>`jsonl` | `extract_records` | **COMPOSE** | UNCLASSIFIED |
| `B->A` | `claims-port`<br>`markdown-file` | `repo-port`<br>`directory-path` | — | **ORTHOGONAL** | UNCLASSIFIED |
| `B->A` | `claims-port`<br>`markdown-file` | `slice-map-port`<br>`text` | `digest` | **COMPOSE** | ADMISSIBLE-SECONDARY |
| `B->A` | `claims-port`<br>`markdown-file` | `prior-fixes-port`<br>`jsonl` | `extract_records` | **COMPOSE** | UNCLASSIFIED |
| `B->A` | `constraints-port`<br>`markdown-file` | `repo-port`<br>`directory-path` | — | **ORTHOGONAL** | UNCLASSIFIED |
| `B->A` | `constraints-port`<br>`markdown-file` | `slice-map-port`<br>`text` | `digest` | **COMPOSE** | ADMISSIBLE-PRIMARY |
| `B->A` | `constraints-port`<br>`markdown-file` | `prior-fixes-port`<br>`jsonl` | `extract_records` | **COMPOSE** | UNCLASSIFIED |
| `B->A` | `citations-port`<br>`jsonl` | `repo-port`<br>`directory-path` | — | **ORTHOGONAL** | UNCLASSIFIED |
| `B->A` | `citations-port`<br>`jsonl` | `slice-map-port`<br>`text` | — | **ORTHOGONAL** | UNCLASSIFIED |
| `B->A` | `citations-port`<br>`jsonl` | `prior-fixes-port`<br>`jsonl` | `identity` | **COMPOSE** | INADMISSIBLE-TYPE-COINCIDENCE |
| `B->A` | `record-port`<br>`markdown-file` | `repo-port`<br>`directory-path` | — | **ORTHOGONAL** | UNCLASSIFIED |
| `B->A` | `record-port`<br>`markdown-file` | `slice-map-port`<br>`text` | `digest` | **CONFLICT** | UNCLASSIFIED |
| `B->A` | `record-port`<br>`markdown-file` | `prior-fixes-port`<br>`jsonl` | `extract_records` | **CONFLICT** | UNCLASSIFIED |
| `B->A` | `day-status-port`<br>`json-file` | `repo-port`<br>`directory-path` | — | **ORTHOGONAL** | UNCLASSIFIED |
| `B->A` | `day-status-port`<br>`json-file` | `slice-map-port`<br>`text` | — | **ORTHOGONAL** | UNCLASSIFIED |
| `B->A` | `day-status-port`<br>`json-file` | `prior-fixes-port`<br>`jsonl` | `wrap_single` | **CONFLICT** | UNCLASSIFIED |

## Totals

| Verdict | Count |
|---------|-------|
| COMPOSE | 16 |
| CONFLICT | 8 |
| ORTHOGONAL | 21 |
| **total** | **45** |

Of the 16 COMPOSE edges, 5 are semantically admissible and 2 are PRIMARY:

- `A->B:audit-port->problem-statement-port`
- `B->A:constraints-port->slice-map-port`

Those two PRIMARY edges are the forward edge and the feedback edge of the
composed loop. Everything else is either type-noise, a degenerate re-run of a
parent's own wave, or a resume-contract collision.

