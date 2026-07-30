# Injected-HITL Benchmark Fixtures — Wave Ω
#
# Per C-001-001 (MUST_TEST), Wave Ω must be tested against an injected-hidden-HITL
# benchmark: a set of target domains where some have planted HITL steps and some
# are clean. The Adversary slot's recall (catches planted HITL) must materially
# exceed a single-Realist baseline.
#
# Fixture schema (one YAML file per fixture, this file defines the schema + index):
#   fixture_id: F-NNN
#   label: planted_hitl | clean
#   target_domain: <one-sentence description>
#   context: <3-5 sentences>
#   probe_responses:
#     - probe_id: P-001
#       kind: read | no-op | observability | side-effect | hitl-trace
#       target: <what the probe looked at>
#       response_summary: <what came back>
#       signals_returned: [<list>]
#       hitl_verbs_detected: [<list, possibly empty>]
#   ground_truth:
#     planted_hitl_steps: [<list of planted HITL steps; empty for clean>]
#     expected_admitted_criteria: [<list of MUST_RESPECT criteria the Realist should propose>]
#     expected_quarantined_criteria: [<list of MUST_TEST criteria the Adversary should quarantine>]
#   difficulty: easy | medium | hard
#   source: <where this fixture was inspired from>
#
# Pass criterion for the Adversary slot:
#   - On planted_hitl fixtures: catches ≥ 1 planted HITL step per fixture
#     (recall = caught / total planted across all planted_hitl fixtures)
#   - On clean fixtures: false-positive rate ≤ 30% (specificity)
#   - Adversary's recall must exceed single-Realist baseline recall by ≥ 15pp
#     (the "materially exceed" threshold from C-001-001)
#
# If the Adversary fails this benchmark, per C-001-001 the slot is "presumed
# theater and replaced by a non-LLM oracle (e.g., a static analyzer over LOOP.md
# flagging verbs-of-deferral)".
#
# Fixture index (20 total: 10 planted_hitl + 10 clean):
include:
  - F-001.yaml   # planted_hitl: GitHub PR loop with hidden "wait for maintainer approval"
  - F-002.yaml   # planted_hitl: Research loop with hidden "ask domain expert"
  - F-003.yaml   # planted_hitl: Lesson writing with hidden "send to teacher for review"
  - F-004.yaml   # planted_hitl: Deployment loop with hidden "pause for manual rollback decision"
  - F-005.yaml   # planted_hitl: Bug triage with hidden "escalate to on-call after 3 retries"
  - F-006.yaml   # planted_hitl: CI monitoring with hidden "wait for code owner review"
  - F-007.yaml   # planted_hitl: Dependency update loop with hidden "request security team sign-off"
  - F-008.yaml   # planted_hitl: Documentation generation with hidden "submit to tech writer for approval"
  - F-009.yaml   # planted_hitl: Test generation with hidden "QA must review before merge"
  - F-010.yaml   # planted_hitl: Refactoring loop with hidden "architect must approve structural changes"
  - F-011.yaml   # clean: GitHub PR loop fully autonomous (merge when CI green + CodeRabbit approves)
  - F-012.yaml   # clean: Research loop fully autonomous (literature search + citation verify + claim triangulation)
  - F-013.yaml   # clean: Lesson writing fully autonomous (source gather + factual review + pedagogical critique, all LLM-based)
  - F-014.yaml   # clean: Deployment loop fully autonomous (canary + auto-rollback on metrics)
  - F-015.yaml   # clean: Bug triage fully autonomous (label + assign + auto-fix-when-confident)
  - F-016.yaml   # clean: CI monitoring fully autonomous (auto-retry + auto-bisection)
  - F-017.yaml   # clean: Dependency update loop fully autonomous (auto-merge on green + auto-revert on regression)
  - F-018.yaml   # clean: Documentation generation fully autonomous (LLM-only, no human review)
  - F-019.yaml   # clean: Test generation fully autonomous (LLM-generated + auto-run + auto-merge)
  - F-020.yaml   # clean: Refactoring loop fully autonomous (LLM-only with structural-equivalence verification)
