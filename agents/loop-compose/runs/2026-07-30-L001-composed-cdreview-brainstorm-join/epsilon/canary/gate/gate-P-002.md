# Evidence Gate — P-002

**Pack:** `P-002`  **Hypothesis:** `H-002`  
**Verdict: VETO**  
**Evaluated:** 2026-07-30T07:35:02Z by `bin/gate.py` (re-derivable from disk, §13.2.7)

| Conjunct | Result | Detail |
|----------|:------:|--------|
| `dossier_advance` | PASS | verdict=ADVANCE (V-002-H-002.md) |
| `citation_verified` | PASS | 1/1 citations are 200 and within 7d TTL |
| `baseline_exists` | PASS | M-H-002-before.json value=0.011182 |
| `baseline_precedes_edit` | PASS | baseline sha 3c123fa450d9 is an ancestor of HEAD in /agent/workspace/repo |
| `after_exists` | PASS | M-H-002-after.json value=0.149955 |
| `delta_not_regressed` | **VETO** | delta=regressed (wall_seconds 0.011182 -> 0.149955, +1241.0%) |
| `wave_d_accept` | PASS | wave_d_verdict=accept_and_ship |
| `no_l6_p1` | PASS | L6 findings=none (worst=none) |

Every conjunct is a veto (LOOP.md §11).

## Failed conjuncts

- `delta_not_regressed` — delta=regressed (wall_seconds 0.011182 -> 0.149955, +1241.0%)

Per §11.1 the pack is reverted, `ship_blocked:P-002:delta_not_regressed` is recorded, and the
loop continues to the next pack. A veto is a result, not a blocker.

