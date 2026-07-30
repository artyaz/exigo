# S-001 — Cycle 001 Claims Ledger

## Verified claims (from ADVANCE dossiers, post-citation-verify)

### Mid-task extraction (R-002)
- Claim: Unbounded recursive loop extraction is a real, measured failure (68 IAL failures in 47/6549 LLM-agent repos; arXiv:2607.01641). Source: I-001-S2, R-002. Confidence: 0.75
- Claim: A hard header-carried `remaining_extraction_depth` (default 3) decremented at dispatch + checked on-path is the correct bound; matches kilocode #8637 fix verbatim (incl. threshold). Source: I-001-S2, R-002. Confidence: 0.75

### Composition (R-003)
- Claim: Actor-network composition is decidable from typed ports + causality interfaces (Zhou & Lee 2008; IBM Rhapsody contract ports). Source: I-001-S3, R-003. Confidence: 0.72
- Claim: Baseline delta-test (composed must beat BOTH parents) = textbook compositionality-as-ablation (SEP; pykeen). Source: I-001-S3, R-003. Confidence: 0.72

### Ship-boundary verification (R-004)
- Claim: A sealed canary run is a sound risk-reduction gate before rollout (LaunchDarkly; Octopus). Source: I-001-S4, R-004. Confidence: 0.50 (capped)
- Claim: Runtime verification of LLM agent loops via state-machine observation is established (AgentGuard 2509.23864; \tool 2508.00500). Source: I-001-S4, R-004. Confidence: 0.50
- Claim: cd-review §0.5.4 day-status SHAPE (state/last_step/blocked_reason/resume_hint) is the universal resume contract. Source: I-001-S4, R-004. Confidence: 0.60

### Cross-loop archive (R-005)
- Claim: 5 of 6 archive artifacts are faithful scale-lifts of exigo primitives (day-status→forge-status; archive quartet→loop-{novelty,constraints,portfolio}.jsonl). Source: I-001-S5, R-005. Confidence: 0.78
- Claim: LINEAGE BLOCK grounded in git's content-addressable commit graph + parent refs (Git Internals; BuildStream CAS-by-SHA256). Source: I-001-S5, R-005. Confidence: 0.78
- Claim: DAG-acyclicity holds because constructive composition A⊕B→C is provably asymmetric, unlike apt depends/rdepends symmetric edges. Source: I-001-S5, R-005. Confidence: 0.78

### Universal failure modes (cross-cutting)
- Claim: Infinite agentic loops are a real, measurable production failure class in LLM-agent repos. Source: I-001-S2, R-002 (arXiv:2607.01641). Confidence: 0.75
- Claim: Sycophantic rubber-stamping by HITL or adversary slots is documented (TechTarget 2026). Source: I-001-S1, R-001. Confidence: 0.62
- Claim: Degenerate compositions ("renamed parent" no-delta) are a real failure class; delta-test rejects them. Source: I-001-S3, R-003 (B-003). Confidence: 0.72

### Exigo-pattern reuse (cross-cutting)
- Claim: All 5 dossiers cite existing exigo LOOP.md primitives, validating cycle-scope grounding. Source: I-001-S1..S5, R-001..R-005. Confidence: 0.80
- Claim: brainstorm §6.3 all-advance DA re-dispatch primitive is lifted one wave earlier (R-001 Adversary slot) and one scale up (R-005 portfolio). Source: I-001-S1+S5, R-001+R-005. Confidence: 0.72
- Claim: cd-review §0.5.4 day-status SHAPE is the shared primitive for R-002 (depth header), R-004 (kill-and-resume oracle), R-005 (forge-status.json). Source: I-001-S2+S4+S5. Confidence: 0.75

## Refuted claims (from ADVANCE/INCONCLUSIVE dossiers)

### Decidability over existing prose
- Refuted claim: Loop combinability is decidable from existing LOOP.md text alone. Source: I-001-S3, R-003. Falsifier: neither existing LOOP.md has a ports block (cd-review/LOOP.md:213-218 prose; brainstorm prose-only headers).
- Refuted claim: cd-review §10.7 step vocabulary (`develop_pushed`, `cr_poll_{N}:{PR}`) is universal. Source: I-001-S4, R-004. Falsifier: §10.7 values are GitHub+CodeRabbit-specific; a "sort numbers" loop emits none.

## Inconclusive claims

### Domain reconnaissance (R-001)
- Inconclusive claim: Autonomy criteria reliably inferable at runtime from probe responses. Source: I-001-S1, R-001. Missing evidence: 2505.17968 (LLMs underperform Bayes at black-box inference, p=0.002); 2604.17609 (30-80pp discover/exploit gap).
- Inconclusive claim: An adversarial slot reliably catches structurally-hidden HITL. Source: I-001-S1, R-001. Missing evidence: no published recall-vs-baseline data; rubber-stamp risk unresolved.

### Archive parameters (R-005)
- Inconclusive claim: cosine dedup threshold 0.92 is universal. Source: I-001-S5, R-005. Missing evidence: RETSim (arXiv:2311.17264) uses 0.1-0.15 — embedding-model-specific.
- Inconclusive claim: canonical-promotion count = 5 loops. Source: I-001-S5, R-005. Missing evidence: NEW primitive absent from brainstorm §7.4; unverified.

## Cross-cutting observations
- 3 of 5 ideas (R-001, R-002, R-004) independently require a built-in discrimination test bench — test-bench-gated primitive promotion is a load-bearing meta-design-pattern.
- R-003's delta-test mitigates R-004's riskiest assumption (reverse-authority circularity); R-004 dossier cites I-003-DELTA as the partial closer.
- R-002's depth-budget prevents infinite-extraction failure from unbounded R-004 micro-cycle recursion; R-005's no-self-composition + no-parent-mutation invariant closes the same failure class on the composition axis.
- R-001's autonomy-criteria inference and R-004's day-status oracle both reuse cd-review §0.5.4 SHAPE — spans recon, ship, and archive.
- 3 of 5 dossiers produced MUST_TEST vs 1 MUST_RESPECT: design is mostly sound but primitives need empirical validation before invariant promotion.
- R-004's §10.7 wording bug exposed cd-review's day-status vocabulary as domain-specific — forces each forged loop to declare its own `last_step` vocabulary (load-bearing correction).
- 5 of 5 ideas cite the existing two-loop pattern — confirms grounding.
