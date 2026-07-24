# `agents/loop-forge/archive/`

Cross-loop memory for the loop-forge meta-loop. Persists across runs.

## Files

### `novelty.jsonl`

One line per design decision produced by any loop-forge cycle. Schema:

```json
{
  "idea_id_local": "I-001-002",
  "cluster_id": "I-001-S1",
  "cycle_id": "cycle-001",
  "subagent_id": "B-001",
  "persona": "dreamer",
  "seed": "s1",
  "idea_title": "Wave-zero domain probe for autonomy-criteria discovery",
  "idea_text": "...",
  "warrant": "...",
  "warrant_hash": "sha256:...",
  "verdict": "INCONCLUSIVE",
  "confidence": 0.62,
  "status": "advance",
  "updated_at": "ISO-8601"
}
```

`status` ∈ `{advance, refute, inconclusive, deferred}`:
- `advance` — shortlisted AND ADVANCE-verdicted
- `refute` — shortlisted AND REFUTE-verdicted
- `inconclusive` — shortlisted AND INCONCLUSIVE-verdicted
- `deferred` — non-shortlisted, preserved for future mutation

`verdict` is `null` for non-shortlisted ideas.

Use this file to dedup new design decisions: compute warrant_hash + embedding
of the new idea, check against existing entries. If warrant_hash matches, the
idea is a duplicate. If embedding cosine ≥ 0.92, the idea is a near-duplicate.

### `constraints.jsonl`

Cross-loop invariants every future loop must satisfy. Schema:

```json
{
  "c_id": "C-001-003",
  "type": "MUST_RESPECT",
  "text": "Every authored LOOP.md must carry a machine-readable typed `ports:` block.",
  "source_loop": "loop-forge",
  "source_idea": "I-001-S3",
  "source_verdict": "ADVANCE",
  "decay_score": 1.0,
  "tags": ["composition", "typed-ports", "backfill"],
  "applied_to": [],
  "canonical": false,
  "created_at": "ISO-8601"
}
```

`type` ∈ `{MUST_RESPECT, MUST_AVOID, MUST_TEST}` (maps 1:1 to ADVANCE/REFUTE/INCONCLUSIVE).

`decay_score`: 1.0 (new) → 0.0. At < 0.3 = `[soft]`; < 0.1 = `[archived]`.
Constraints tagged `[canonical]` are load-bearing invariants that never decay.

`applied_to`: list of loop_ids that have already satisfied this constraint.

A constraint surviving 5 loops without violation is promoted to `[canonical]`
(per C-001-005; the threshold of 5 is tunable).

### `cycles.json`

Cycle index. Schema:

```json
{
  "session_started_at": "...",
  "session_stop_reason": null,
  "cycles": [
    {
      "id": "cycle-001",
      "cycle_num": 1,
      "started_at": "...",
      "ended_at": "...",
      "run_root": "agents/loop-forge/_meta-session/runs/2026-07-25-C001",
      "cycle_type": "scout",
      "idea_count": 47,
      "shortlist_count": 5,
      "advance_count": 4,
      "refute_count": 0,
      "inconclusive_count": 1,
      "tokens_used_estimate": 350000,
      "status": "complete",
      "stop_reason": "goal-anchored-met"
    }
  ]
}
```

### `citations.jsonl`

Cross-cycle citation verification cache (7-day TTL). Schema:

```json
{
  "url": "https://arxiv.org/abs/2607.01641",
  "host": "arxiv.org",
  "subagent_id": "R-002",
  "live_status": 200,
  "verdict": "verified",
  "title": "...",
  "matched_terms": ["infinite", "loop", "agent"],
  "verified_at": "ISO-8601",
  "ttl_days": 7
}
```

Entries expire after 7 days; re-verification refreshes the TTL.

## Update rules

- **Mid-cycle reads** from `archive/` are allowed (novelty dedup, constraint
  retrieval, citation cache lookup).
- **Mid-cycle writes** to `archive/` are FORBIDDEN. Only the orchestrator's
  end-of-cycle archive-update step writes here.
- **Canonical constraints** (tagged `[canonical]`) never decay and never
  archive — they are load-bearing invariants of the autonomy mandate.
