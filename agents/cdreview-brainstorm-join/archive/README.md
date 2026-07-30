# Archive — cross-cycle memory

Persists across cycles. **Written only by the orchestrator's end-of-cycle
archive-update step** (`LOOP.md` §14). Mid-cycle reads are allowed; mid-cycle
writes are forbidden.

Nothing here is ever deleted. A reversal is expressed as a *later* entry carrying
`reverses: <earlier_id>` plus a reason — a loop that edits its own history cannot
be audited.

| File | Shape | Purpose |
|------|-------|---------|
| `verified-improvements.jsonl` | append-only | **The join.** One record per claim that reached a verdict, with its gate outcome and measured delta. Read at `LOOP.md` §1.3 for stare decisis: a claim refuted in cycle 3 stays refuted in cycle 9 without spending a wave re-deriving it. |
| `measurements.jsonl` | append-only | Metric history per slice and metric. Powers the §4 slice re-aim (regressed slices outrank untouched ones) and the §16.2 measurement-plateau stop condition. |
| `novelty.jsonl` | append-only | `warrant_hash` + embedding + status per hypothesis, for Wave H dedup (cosine > 0.85 is a duplicate). |
| `constraints.jsonl` | decay-scored | Next-cycle constraints. `decay_score` drops each cycle a constraint goes unused; the §4 aim reads those at ≥ 0.3 plus `[soft]`-tagged. |
| `citations.jsonl` | 7-day TTL | Citation verification cache. A cache hit inside TTL counts as verified for the gate's `citation_verified` conjunct. |
| `cycles.json` | index | Cycle id, started/ended, status, tokens, `session_stop_reason`. |

## Record shapes

### `verified-improvements.jsonl`

```json
{
  "id": "VI-2026-07-31-J001-H003",
  "cycle": "2026-07-31-J001",
  "hypothesis_id": "H-003",
  "warrant_hash": "sha256:…",
  "claim": "collapsing the duplicate plan-limit lookup removes a divergence risk",
  "verdict": "ADVANCE",
  "qualifier": 0.78,
  "outcome": "shipped | refuted_at_gate | refuted_at_verify | inconclusive",
  "gate": {"verdict": "pass", "failed_conjunct": null},
  "metric": {"name": "exported_symbols", "before": 14, "after": 9, "delta": "improved"},
  "pr": {"develop": 231, "main": 232},
  "reverses": null,
  "recorded_at": "ISO-8601"
}
```

`outcome: refuted_at_gate` is what makes a negative result reusable — the next
cycle's Wave H sees the `warrant_hash` and will not re-propose it.

### `measurements.jsonl`

```json
{
  "cycle": "2026-07-31-J001", "slice": "S1", "hypothesis_id": "H-003",
  "metric": "exported_symbols", "direction": "lower_is_better",
  "before": 14, "after": 9, "raw_delta": -5, "pct_change": -35.7,
  "noise_threshold": 0.0, "delta": "improved",
  "before_git_sha": "…", "after_git_sha": "…", "computed_at": "ISO-8601"
}
```

### `constraints.jsonl`

```json
{
  "id": "C-J-031", "cycle_written": "2026-07-31-J001",
  "type": "MUST_RESPECT | MUST_AVOID | MUST_TEST",
  "text": "plan-limit numerics come from shared/planConfig.ts LIMITS_BY_TIER only",
  "source_dossier": "V-004-H-003", "slice_hint": "S1",
  "decay_score": 1.0, "soft": false, "last_used_cycle": "2026-07-31-J001"
}
```
