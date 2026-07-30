# Evidence Gate — P-001

**Pack:** `P-001`  **Hypothesis:** `H-001`  
**Verdict: PASS**  
**Evaluated:** 2026-07-30T07:35:01Z by `bin/gate.py` (re-derivable from disk, §13.2.7)

| Conjunct | Result | Detail |
|----------|:------:|--------|
| `dossier_advance` | PASS | verdict=ADVANCE (V-001-H-001.md) |
| `citation_verified` | PASS | 1/1 citations are 200 and within 7d TTL |
| `baseline_exists` | PASS | M-H-001-before.json value=0.077677 |
| `baseline_precedes_edit` | PASS | baseline sha 3c123fa450d9 is an ancestor of HEAD in /agent/workspace/repo |
| `after_exists` | PASS | M-H-001-after.json value=0.011776 |
| `delta_not_regressed` | PASS | delta=improved (wall_seconds 0.077677 -> 0.011776, -84.8%) |
| `wave_d_accept` | PASS | wave_d_verdict=accept_and_ship |
| `no_l6_p1` | PASS | L6 findings=none (worst=none) |

Every conjunct is a veto (LOOP.md §11).

