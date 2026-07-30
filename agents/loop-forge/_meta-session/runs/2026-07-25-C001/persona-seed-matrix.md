# Persona × Seed Matrix — Cycle 001 — Updated Post-α

## Dispatch matrix (post-α: all 10 subagents completed)

| Subagent ID | Persona | Seed | Output path | Ideas | Status |
|-------------|---------|------|-------------|-------|--------|
| B-001 | dreamer | s1 | brainstorm/B-001-dreamer-s1.md | 7 | ✓ |
| B-002 | dreamer | s2 | brainstorm/B-002-dreamer-s2.md | 5 | ✓ |
| B-003 | skeptic | s1 | brainstorm/B-003-skeptic-s1.md | 4 | ✓ |
| B-004 | skeptic | s2 | brainstorm/B-004-skeptic-s2.md | 3 | ✓ |
| B-005 | engineer | s1 | brainstorm/B-005-engineer-s1.md | 5 | ✓ |
| B-006 | engineer | s2 | brainstorm/B-006-engineer-s2.md | 6 | ✓ |
| B-007 | outsider | s1 | brainstorm/B-007-outsider-s1.md | 4 | ✓ |
| B-008 | outsider | s2 | brainstorm/B-008-outsider-s2.md | 5 | ✓ |
| B-009 | synthesizer | s1 | brainstorm/B-009-synthesizer-s1.md | 4 | ✓ |
| B-010 | synthesizer | s2 | brainstorm/B-010-synthesizer-s2.md | 4 | ✓ |

Total ideas generated: 47.

## Collapse detector

For each persona, compare s1 vs s2 idea-docs. All 5 personas produced distinct s1/s2 outputs (s2 applied oblique-strategy scale-shift; s1 stayed on original problem). No persona flagged `collapsed`.

## Thematic clustering (47 ideas → 10 themes)

| Theme | Representative ideas |
|-------|---------------------|
| 1. Domain reconnaissance / autonomy discovery | I-001-002 (B-001), I-001-006 (B-001), I-001-001 (B-005), I-004-ADV-REFUTE (B-003), I-001-LRG (B-006), I-003-TRA (B-008) |
| 2. Composition / combinability | I-001-003 (B-001), I-003-COMPOSE (B-002), I-003-DELTA (B-003), I-003-CMP (B-006), I-003-ZONE (B-007), I-001-MYC (B-008), I-005-MORPH (B-008) |
| 3. Mid-task extraction | I-001-004 (B-001), I-004-EXTRACT (B-002), I-001-DEPTH (B-003), I-002-MORPH (B-007), I-004-PREC (B-007), I-001-MYC fruiting (B-008) |
| 4. Self-simulation / ship verification gate | I-001-005 (B-001), I-002-CANARY (B-003), I-001-003 (B-005), I-001-005 (B-005) |
| 5. Ship-boundary anti-sycophancy | I-004-3SV (B-004), I-004-LFC (B-009), I-007-NHI (B-004), I-003-PRK (B-004) |
| 6. Loop artifacts / cross-loop archive | I-001-PORTFOLIO (B-002), I-002-PTF (B-006), I-004-NVL (B-006), I-005-LCN (B-006), I-006-FST (B-006), I-001-007 (B-001), I-003-LFC (B-009) |
| 7. Wave architecture / authoring | I-002-LOOPSCOPE (B-002), I-001-002 (B-005), I-001-LFC (B-009), I-002-LFC (B-009), I-005-DIVERSELOOP (B-002), I-001-001 (B-010), I-001-003 (B-010), I-001-004 (B-010) |
| 8. Self-amendment / constitution | I-001-CONV (B-007), I-001-001 (B-001), I-002-JUR (B-008), I-004-SAUC (B-008) |
| 9. Inter-loop constraint propagation | I-001-002 (B-010) |
| 10. Lens / review framework | I-001-004 (B-005) |

## Shortlist (5 cluster-ideas, covering all 6 success-shape dimensions)

| Idea-id | Cluster title | Source ideas | Success-shape dim covered |
|---------|---------------|--------------|----------------------------|
| I-001-S1 | Wave Ω: Domain reconnaissance with adversarial autonomy-criteria slots | B-001 I-001-002 + B-003 I-004-ADV-REFUTE | (2) domain reconnaissance wave, (3) decision-making under self-critique, (9) universality |
| I-001-S2 | Loop-itch + depth-budget + checkpointable mid-task extraction protocol | B-001 I-001-004 + B-003 I-001-DEPTH + B-002 I-004-EXTRACT | (5) mid-task extraction protocol |
| I-001-S3 | Typed ports + 3-state composition verdict + baseline delta-test | B-001 I-001-003 + B-002 I-003-COMPOSE + B-003 I-003-DELTA | (4) composition protocol, combinability |
| I-001-S4 | Canary-run ship gate + reverse-authority micro-cycle + day-status acceptance oracle | B-001 I-001-005 + B-003 I-002-CANARY + B-005 I-001-003 + B-005 I-001-005 | ship-boundary verification, autonomy proof |
| I-001-S5 | Loop-genome archive: PORTFOLIO.md + loop-portfolio.json + loop-novelty.jsonl + loop-constraints.jsonl + forge-status.json + lineage block | B-002 I-001-PORTFOLIO + B-006 I-002-PTF + B-006 I-004-NVL + B-006 I-005-LCN + B-006 I-006-FST + B-001 I-001-007 | (7) cross-cycle archive, lineage |

The two-layer harness (success-shape dim 1) is inherited as baseline from cd-review + brainstorm and not re-shortlisted (already proven).

## Wave β dispatch plan

5 parallel research subagents:
- R-001 → I-001-S1 (recon + adversarial autonomy slots)
- R-002 → I-001-S2 (mid-task extraction protocol)
- R-003 → I-001-S3 (composition primitive)
- R-004 → I-001-S4 (canary ship gate)
- R-005 → I-001-S5 (loop-genome archive)

Each subagent: 7-step Toulmin dossier + 3-state verdict. Output path: `research/R-00N-I-001-SN.md`.
