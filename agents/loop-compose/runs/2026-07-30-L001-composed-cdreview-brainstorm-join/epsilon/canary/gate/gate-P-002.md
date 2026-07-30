# Evidence Gate — P-002

**Pack:** `P-002`  **Hypothesis:** `H-002`  
**Verdict: VETO**  
**Evaluated:** 2026-07-30T07:01:35Z by `bin/gate.py` (re-derivable from disk, §13.2.7)

| Conjunct | Result | Detail |
|----------|:------:|--------|
| `dossier_advance` | PASS | verdict=ADVANCE (V-002-H-002.md) |
| `citation_verified` | PASS | 1/1 citations are 200 and within 7d TTL |
| `baseline_exists` | PASS | M-H-002-before.json value=0.009969 |
| `baseline_precedes_edit` | PASS | ancestry check skipped (sealed canary: --skip-git-ancestry) |
| `after_exists` | PASS | M-H-002-after.json value=0.148592 |
| `delta_not_regressed` | **VETO** | delta=regressed (wall_seconds 0.009969 -> 0.148592, +1390.5%) |
| `wave_d_accept` | PASS | wave_d_verdict=accept_and_ship |
| `no_l6_p1` | PASS | L6 findings=none (worst=none) |

Every conjunct is a veto (LOOP.md §11).

## Failed conjuncts

- `delta_not_regressed` — delta=regressed (wall_seconds 0.009969 -> 0.148592, +1390.5%)

Per §11.1 the pack is reverted, `ship_blocked:P-002:delta_not_regressed` is recorded, and the
loop continues to the next pack. A veto is a result, not a blocker.

