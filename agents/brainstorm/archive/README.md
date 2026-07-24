# archive/ — cross-cycle memory for the brainstorming loop

This directory is the **only** thing that persists across `runs/YYYY-MM-DD-CNNN/` folders. It is updated **only** by the orchestrator's end-of-cycle archive-update step (see `../LOOP.md` §7.3). Mid-cycle reads from this directory are allowed (novelty dedup, constraint retrieval, citation cache lookup); mid-cycle writes are forbidden.

## Files

### `novelty.jsonl`

One line per idea ever produced across all cycles. Monotonically grows. Used for cross-cycle dedup (new ideas are checked against this archive via embedding cosine similarity + warrant hash).

Schema (one JSON object per line):

```json
{"idea_id":"I-007-003","cycle_id":"cycle-007","persona":"dreamer","seed":"s2","idea_text":"…","warrant":"…","warrant_hash":"sha256:…","embedding":[0.0123,…],"verdict":"ADVANCE","confidence":0.78,"status":"advance","deferred":false,"updated_at":"2026-07-25T14:50:00Z"}
```

`status` field is lowercase 4-state:
- `advance` — shortlisted idea with ADVANCE verdict
- `refute` — shortlisted idea with REFUTE verdict
- `inconclusive` — shortlisted idea with INCONCLUSIVE verdict
- `deferred` — non-shortlisted idea (preserved for future mutation; not rejected)

A `deferred` idea's status may flip to `advance`/`refute`/`inconclusive` if a future cycle shortlists a mutation of it.

### `constraints.jsonl`

One line per constraint ever extracted. Monotonically grows (constraints are never deleted — they decay). Constraints are the load-bearing feedback mechanism between cycles.

Schema:

```json
{"constraint_id":"C-007-003","cycle_id":"cycle-007","source_idea_id":"I-007-014","source_verdict":"REFUTE","source_reason":"assumption A unsupported","text":"Do not propose ideas that depend on Assumption A","type":"MUST_AVOID","tags":["assumption-A","kill-derived"],"decay_score":1.0,"created_at":"2026-07-25T14:50:00Z","last_applied_cycle":"cycle-007"}
```

Decay rules:
- A constraint that was applied this cycle (an idea was rejected for violating it) keeps `decay_score = 1.0` and updates `last_applied_cycle`.
- A constraint that was NOT applied decays by 0.15 per cycle.
- At `decay_score < 0.3`: marked `[soft]` — orchestrator MAY relax it; passed to next cycle's Wave α with a `[soft]` tag.
- At `decay_score < 0.1`: marked `[archived]` — kept for audit, NOT passed to Wave α.

This prevents the constraint set from monotonically narrowing the idea space (gap G11 fix).

### `cycles.json`

Cycle index. Updated at end-of-cycle archive-update.

Schema:

```json
{
  "cycles": [
    {
      "id": "cycle-001",
      "cycle_num": 1,
      "started_at": "2026-07-25T14:00:00Z",
      "ended_at": "2026-07-25T14:51:00Z",
      "run_root": "runs/2026-07-25-C001",
      "cycle_type": "scout",
      "idea_count": 10,
      "shortlist_count": 5,
      "advance_count": 2,
      "refute_count": 2,
      "inconclusive_count": 1,
      "tokens_used": 348211,
      "status": "complete",
      "stop_reason": "goal-anchored-met"
    }
  ],
  "session_stop_condition": "find 3 ideas worth implementing OR max 10 cycles",
  "session_stop_reason": null,
  "cycles_remaining": 9
}
```

### `citations.jsonl`

Cross-cycle citation verification cache (7-day TTL). Merged from per-cycle `runs/YYYY-MM-DD-CNNN/citations/verified.jsonl` + `refuted.jsonl` at end-of-cycle archive-update. Reduces steady-state citation-verify cost from ~15k to ~5k tokens (cache hits skip live-fetching).

Schema:

```json
{"url":"https://example.com/paper","url_hash":"sha256:…","fetched_at":"2026-07-25T14:42:00Z","live_status":200,"content_match_score":0.87,"verdict":"verified","last_seen_cycle":"cycle-007","ttl_expires_at":"2026-08-01T14:42:00Z"}
```

`verdict` field: `verified` | `content_mismatch` | `mismatch` | `unverified` (404/timeout).

Entries with `ttl_expires_at < now` are eligible for re-verification on next read.

## Maintenance

The `archive/` directory is append-mostly. Periodic compaction (outside the loop) may:
- Drop `novelty.jsonl` entries with `status="deferred"` older than 90 days (preserved for audit in cold storage).
- Drop `citations.jsonl` entries past TTL.
- NEVER drop `constraints.jsonl` entries (audit trail must be complete).
- NEVER drop `cycles.json` entries (history is immutable).

These compactions are NOT performed by the loop itself; they are operational concerns for the repo maintainer.
