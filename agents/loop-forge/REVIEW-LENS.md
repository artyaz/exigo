# Wave D — Pre-PR subagent review lens catalogue

This file is the **single source of truth** for Wave D reviewers (the
pre-PR internal review stage defined in `LOOP.md` §7.5). Wave D runs
**after** Wave C verify and **before** the ship protocol (§10.2). Its
job is to produce a high-quality review of the drafted loop files so
the orchestrator can either send the draft back to Wave C (P0/P1
residual) or open the PR with confidence.

Wave D reviewers are **subagents** of the day-scope orchestrator. They
do not edit product code or the draft. They do not spawn children.
They write one file each to `$RUN_ROOT/audits/pre-pr/{LOOP_NAME}-lens{N}.md`
and the orchestrator consolidates into
`$RUN_ROOT/audits/pre-pr/{LOOP_NAME}.md`.

---

## 0. Why a pre-PR stage at all

External reviewers (CodeRabbit, human reviewers, etc.) land **after**
the PR is open. If the new loop's `LOOP.md` has a real autonomy hole
(e.g. a hidden "ask a human" stub) or a combineability hazard (e.g.
inputs that aren't actually declared), that flaw is now in the open
PR history, on the `develop` branch, and visible to anyone watching
the repo. A 5-minute internal review by N parallel subagents — each
looking through a different lens — catches the bulk of P0/P1 issues
before the PR exists, which means:

- fewer force-pushes to `develop` to fix post-review nits
- fewer `@reviewer handle` re-trigger cycles
- a cleaner main-PR diff for the external reviewer, so its findings
  are higher-signal and the iteration cap (§10.2 step 3) is reached
  faster
- a guaranteed minimum quality bar: every shipped loop has been
  audited for autonomy, combineability, universality, and resilience
  by independent reviewers

Wave D is **not** a replacement for any external reviewer. It is a
cheap, parallel, in-process pre-filter.

---

## 1. Lenses

Each Wave D dispatch fans out to **four** reviewer subagents, one per
lens. The orchestrator MAY add a fifth lens (`lens5`) for very large
drafts; otherwise lens 5 is skipped.

| Lens | Focus | Looks at |
|------|-------|----------|
| **L1 — Autonomy completeness** | Every decision point has an autonomous resolution path; no "ask a human" stubs; no hidden HITL dependencies (merge permissions, token assumptions, external-system waits) | All sections of the produced `LOOP.md`, especially §0.5.3, §10.5, §12 |
| **L2 — Combineability** | The produced loop's §11 contract is precise enough that another loop can chain to it; inputs/outputs/side effects are explicit; chaining hazards are called out; anti-patterns are listed | Produced `LOOP.md` §11 + any files referenced there |
| **L3 — Universality** | The produced loop is not artificially scoped to one tool, platform, or domain; domain specifics live in §11 / §13, not in the wave logic; the loop's name and one-sentence purpose are tool-agnostic | Produced `LOOP.md` §0, §2, §3, §13 + the trigger brief |
| **L4 — Resilience** | `day-status.json` schema is crash-safe; side effects are idempotent; shipped-work-never-rerun invariant holds; exit conditions and terminal states are well-defined; rate-limit / flake policy covers every external call | Produced `LOOP.md` §0.5.4, §8.3, §10.5, §10.6, §10.7 + the entry script |
| L5 (optional) — Concision | Only dispatched when the produced `LOOP.md` is over 800 lines. Checks for over-specification, redundant sections, and "ceremony" that should be a skill instead. | Produced `LOOP.md` in full |

Lenses are **independent**: each reviewer sees only its lens brief,
the staged diff of all new product files, this `LOOP.md` as a
reference, and `agents/cd-review/LOOP.md` as a second reference (a
working loop the new one can be compared against). They do not see
each other's output. The orchestrator consolidates.

---

## 2. Reviewer brief template

```text
You are a WAVE D pre-PR reviewer for loop-forge, lens {N} ({LENS_NAME}).
RUN_ROOT={RUN_ROOT}
LOOP_NAME={NEW_LOOP_NAME}
LENS={N}
OWNED FILES (the draft):
- loops/{NEW_LOOP_NAME}.md
- agents/{NEW_LOOP_NAME}/LOOP.md
- agents/{NEW_LOOP_NAME}/REVIEW-LENS.md  (if present)
- scripts/{NEW_LOOP_NAME}-autonomous.sh

INPUT YOU MUST READ
- agents/loop-forge/LOOP.md §7.5 (your role and acceptance gate)
- agents/loop-forge/REVIEW-LENS.md §3 (lens {N} checklist) and §4
  (output format)
- agents/loop-forge/LOOP.md (the reference loop — this is what a
  working loop looks like)
- agents/cd-review/LOOP.md (a second reference — a different working
  loop in a different domain)
- The staged diff for this draft:
    git -C {REPO_ROOT} diff develop...HEAD -- loops/{NEW_LOOP_NAME}.md \
                                              agents/{NEW_LOOP_NAME}/ \
                                              scripts/{NEW_LOOP_NAME}-autonomous.sh
- The Wave C draft report (what the drafter claims to have done):
    {RUN_ROOT}/audits/drafts/draft.md
- Optional: the design package the drafter executed, for design context:
    {RUN_ROOT}/audits/designs/{DESIGN_ID}.md

LENS {N} FOCUS
{LENS_SPECIFIC_INSTRUCTIONS_FROM_SECTION_3_BELOW}

RULES
- Do NOT edit product code or the draft.
- Do NOT spawn subagents.
- Do NOT re-open design — Wave B already chose the approach. You review
  the implementation, not the design. A design objection is a P2
  "consider revisiting in next forge run" finding, not a send-back.
- Read EVERY section of the produced LOOP.md. A skim is a failure.
- For each finding, give: severity, file:section (e.g.
  `agents/{NEW_LOOP_NAME}/LOOP.md:§10.5`), what is wrong, why it hurts
  the north star (autonomy → combineability → universality → resilience
  → readability), and a concrete suggested fix (a 1–3 line patch or a
  rewritten section stub, not a redesign).
- If you find nothing actionable, say so explicitly with a "clean bill"
  note listing the 3–5 riskiest sections you examined and why they are
  OK. Empty praise is failure; an unjustified clean bill is also
  failure.

OUTPUT — write {RUN_ROOT}/audits/pre-pr/{NEW_LOOP_NAME}-lens{N}.md
using the format in REVIEW-LENS.md §4. Return to the orchestrator:
severity counts + top 3 + list of finding IDs.

ACCEPTANCE GATE (orchestrator applies, you do not decide)
- P0 or P1 findings → draft goes back to Wave C.
- P2 findings → orchestrator fixes or accepts with reason in RECORD.
- P3 nitpicks → accept with reason, or batch-fix if cheap.
See LOOP.md §7.5.3 for the consolidation rule.
```

---

## 3. Per-lens checklists

### 3.1 Lens 1 — Autonomy completeness

Adversarial stance: **assume the loop secretly needs a human
somewhere.** Apply all of these to every section of the produced
`LOOP.md`:

- **§0.5.3 no-human rule**: present verbatim or equivalent. Missing
  or watered-down ("ask a human if unclear") is a P0.
- **§10.5 exit conditions**: every exit state has a launcher action.
  A state with "human triage" as the only action is fine for
  `fatal_blocked` but is a P1 for any other state.
- **§12 autonomy checklist**: present, populated, and every decision
  point in the loop is listed. A loop with waves but no §12 is a P0.
- **Hidden HITL in ship protocol**: every "wait for X" in the ship
  protocol (§10.2 of the produced loop) must have a timeout and a
  fallback that does not involve a human. A "wait for human to merge"
  is a P0; "wait for CI to go green" with no timeout is a P1.
- **External-system waits**: every external call (reviewer, CI,
  deploy) has a poll interval, a max-poll count, and a `blocked`
  escalation. Missing any of the three is a P1.
- **Token / auth assumptions**: the loop must detect token scope
  issues and exit `fatal_blocked` with a precise reason. A loop that
  silently retries on 401 is a P1.
- **Decision points in waves**: every wave's brief must end with a
  deterministic "return to orchestrator" — no "discuss with the team"
  or "decide based on judgement" without a fallback rule. Missing
  fallback is a P2.
- **Wave E (if the produced loop has one)**: the nested-run handoff
  must be idempotent and the parent must not poll in a tight loop.
  Violations are P1.
- **"Ask a human" language**: search the produced `LOOP.md` for the
  phrases "ask a human", "pause and ask", "wait for user", "email
  the team", "notify the team". Any hit is a P0 unless the section
  explicitly says "this is forbidden" and provides an autonomous
  alternative.

### 3.2 Lens 2 — Combineability

Adversarial stance: **assume another loop will try to chain to this
one via §11 alone, without reading the rest of the file.** Apply:

- **§11 presence**: the produced `LOOP.md` MUST have a §11. Missing
  is a P0.
- **Inputs declared**: every input the loop reads from a caller is
  listed with type, required-ness, source, and notes. An input
  mentioned in wave briefs but not in §11 is a P1.
- **Outputs declared**: every output a caller might read is listed
  with type, location, lifecycle (persisted / ephemeral), and notes.
  An output written to `$RUN_ROOT/...` but not in §11 is a P1.
- **Visible side effects declared**: every side effect a caller must
  tolerate (PRs opened, vector-store writes, deploys triggered,
  messages sent) is listed with trigger condition, idempotency
  status, and rollback procedure. An undeclared side effect is a P1
  (P0 if it cannot be rolled back).
- **Chaining patterns**: at least one of {sequential, pipelined,
  sibling (Wave E)} is documented with a concrete example. Missing
  all three is a P2.
- **Anti-patterns**: at least one anti-pattern is listed (e.g. "do
  not call this loop from inside a Wave A subagent"). Missing is a
  P3 — a loop with no anti-patterns probably has not been thought
  about from the caller's perspective.
- **Pointer file**: `loops/{NEW_LOOP_NAME}.md` exists and links to
  `agents/{NEW_LOOP_NAME}/LOOP.md`. Missing or broken link is a P1.
- **Name stability**: the loop's name appears consistently in the
  pointer, the directory, the LOOP.md title, the entry script
  filename, and the branch naming convention. Inconsistency is a P2
  (it breaks chaining because callers reference the name).

### 3.3 Lens 3 — Universality

Adversarial stance: **assume the trigger brief snuck in a
domain-specific assumption that does not belong in the wave logic.**
Apply:

- **§0 / §2 / §3 are domain-agnostic**: the loop's purpose, north
  star, and wave architecture do not name a specific tool, platform,
  or domain unless the trigger brief explicitly demanded it. A wave
  brief that says "use GitHub" or "use OpenAI" is a P1 — those
  belong in §11 / §13.
- **§11 / §13 hold the domain specifics**: every domain-specific
  thing (VCS, CI, LLM provider, data store) is declared in §11 or
  noted in §13. A domain-specific assumption in §5 / §6 / §7 is a
  P1.
- **Loop name and one-sentence purpose**: tool-agnostic. A name
  like `github-pr-loop` is a P2 (couples the loop to one VCS); a
  name like `ship-loop` or `code-review-loop` is fine. A
  one-sentence purpose that names a specific product is a P2.
- **Wave logic does not import domain skills directly**: if a wave
  brief says "load skill X", X must be either a generic skill
  (brainstorming, coding-guidelines) or a skill the discover wave
  identified as needed for this loop's domain. A hardcoded skill
  reference is a P2.
- **Entry script is portable**: `scripts/{NEW_LOOP_NAME}-autonomous.sh`
  does not hardcode paths, tokens, or repo URLs that would not work
  on a fork. Hardcoded absolute paths are a P2; hardcoded secrets
  are a P0.
- **Reference to this loop's own parent**: if the produced loop
  mentions `loop-forge` or `cb-review`, it should be as a reference
  ("modeled on agents/cd-review/LOOP.md §0.5"), not as a runtime
  dependency. A runtime dependency on another loop's files is a P1
  (use the combineability contract instead).

### 3.4 Lens 4 — Resilience

Adversarial stance: **assume the loop will be killed at the worst
possible moment.** Apply:

- **§0.5.4 day-status.json schema**: present, with `state`,
  `last_step`, `branch`, `prs`, `blocked_reason`, `resume_hint`,
  `updated_at`. Missing any field is a P1. Extra fields are fine.
- **§8.3 continuity invariants**: present, with all five invariants
  (status-before-side-effect, idempotent side effects,
  shipped-work-never-rerun, PR-numbers-persisted, RECORD-append-only).
  Missing one is a P1. Missing all is a P0.
- **Side effects are idempotent**: every side effect in the ship
  protocol (§10.2) has an idempotency note. A non-idempotent side
  effect without a justification is a P1.
- **§10.5 exit conditions**: every state in
  `running|shipping|waiting_external|blocked|fatal_blocked|complete|budget_exhausted`
  (plus `self_extending` if Wave E is used) has a launcher action.
  Missing is a P1.
- **§10.6 rate-limit / flake policy**: every external call has a
  row in the policy table. A loop that calls an external system
  without a row is a P1.
- **§10.7 state machine**: canonical `last_step` values are listed
  and the resume logic is explained. Missing is a P1.
- **Wave E (if used)**: `wave_e_run_root` is set before the nested
  spawn; the parent does not poll in a tight loop; the nested run's
  `day-status.json` is the only source of truth for the nested run.
  Violations are P1.
- **Entry script**: `bash -n scripts/{NEW_LOOP_NAME}-autonomous.sh`
  passes. The script handles `set -Eeuo pipefail`, has an ERR trap,
  and does not exit 0 on a fatal block. Violations are P1.
- **Resume test (thought experiment)**: imagine the loop is killed
  between `develop_pushed` and `develop_pr_open`. The next wake
  reads `last_step=develop_pushed`, resumes from
  `develop_pr_open`, checks `gh pr list --head` first (idempotent),
  opens the PR if none exists. If this thought experiment fails for
  any `last_step` transition, that is a P1.

### 3.5 Lens 5 (optional) — Concision

Only dispatched when the produced `LOOP.md` is over 800 lines.

- **Over-specification**: any section that says in 50 lines what
  could be said in 10 is a P2.
- **Redundant sections**: if §X and §Y cover the same ground, one
  should be deleted. P2.
- **Ceremony that should be a skill**: if a wave or sub-step is
  small, deterministic, and one-shot, it should be a skill the loop
  loads, not a wave of the loop. P2.
- **Domain over-specification**: if §11 / §13 are longer than the
  wave logic, the loop is probably over-scoped to its domain and
  should be split. P2.
- **Reference loops**: compare the produced `LOOP.md` line count to
  `agents/cd-review/LOOP.md` and `agents/loop-forge/LOOP.md`. If
  the produced loop is 2x longer without justification, that is a
  P2.

---

## 4. Output format

Each reviewer writes one file:
`$RUN_ROOT/audits/pre-pr/{NEW_LOOP_NAME}-lens{N}.md`.

```markdown
# Wave D review — {NEW_LOOP_NAME} — lens {N} ({LENS_NAME})

**Reviewer:** subagent (model: leave blank for orchestrator to fill)
**Reviewed at:** ISO-8601
**Diff range:** develop...HEAD
**Owned files reviewed:** {count}
**Findings:** P0={n} P1={n} P2={n} P3={n}

## Summary
{2–3 sentences. What does the draft do, and is the implementation
sound through this lens? If there are P0/P1, name them here.}

## Walkthrough
{Numbered, section-by-section narrative of the new LOOP.md — each
step: section, what it says, why it matters through this lens.}

## Findings

### D-{NEW_LOOP_NAME}-L{N}-{nnn}: {title}
- Severity: P0|P1|P2|P3
- Location: {file}:{section or line range}
- What is wrong:
- Why it hurts (north-star / autonomy / combineability / universality
  / resilience / readability):
- Suggested fix (1–3 line patch or rewritten section stub, not a
  redesign):
```diff
{optional unified diff or section stub}
```

## Finishing touches checklist
- [ ] Autonomy: {note or "n/a" for L1}
- [ ] Combineability: {note or "n/a" for L2}
- [ ] Universality: {note or "n/a" for L3}
- [ ] Resilience: {note or "n/a" for L4}
- [ ] Concision: {note or "n/a" for L5}

## Clean bill justification (only if zero P0/P1/P2)
{List the 3–5 riskiest sections you examined and why they are OK. An
unjustified clean bill is a failure.}

## Top 3 (for orchestrator)
1. {finding id} — {one line}
2. {finding id} — {one line}
3. {finding id} — {one line}
```

---

## 5. Consolidation rule (orchestrator)

The orchestrator reads all `lens{N}.md` files for `{NEW_LOOP_NAME}`
and writes a single `$RUN_ROOT/audits/pre-pr/{NEW_LOOP_NAME}.md`:

```markdown
# Wave D consolidated review — {NEW_LOOP_NAME}

**Lenses run:** L1, L2, L3, L4{, L5}
**Raw findings:** P0={n} P1={n} P2={n} P3={n}
**Deduplicated findings:** P0={n} P1={n} P2={n} P3={n}
**Verdict:** {send_back_to_wave_C | fix_and_proceed | accept_and_ship}

## Deduplicated finding index
| ID | Severity | Location | Lens(es) | Action |
|----|----------|----------|----------|--------|

## Verdict rationale
{1–2 paragraphs. Why send back, fix-and-proceed, or accept-and-ship.}

## Accepted-with-reason (P2/P3 only)
- {finding id}: accepted because {reason}.
```

Deduplication: same `file:section` + same root cause = one finding,
merge severities (max wins). Different lenses flagging the same
section for different reasons stay separate.

Acceptance gate (LOOP.md §7.5.3):

- Any P0 or P1 remaining → `send_back_to_wave_C`. Wave C must fix and
  Wave D re-runs (only on the touched-again files, see §6).
- P2 remaining → orchestrator fixes inline (cheap) OR accepts with
  reason in the consolidated file AND in `RECORD.md`.
- P3 remaining → accept with reason, or batch-fix if cheap.

---

## 6. Re-review after send-back

If Wave D sent a draft back to Wave C, Wave C fixes only the flagged
findings. Wave D then re-runs **only on the files Wave C touched in
this round**, not on the whole draft. This keeps the re-review cheap
and prevents the "Wave D keeps finding new nits" death spiral.

The orchestrator tracks review rounds in the consolidated file:

```markdown
## Review rounds
| Round | Files reviewed | Findings | Verdict |
|-------|----------------|----------|---------|
| 1     | all owned      | P0=1 P1=2 P2=3 | send_back_to_wave_C |
| 2     | subset (2 files) | P2=1 | accept_and_ship |
```

Hard cap: **3 review rounds.** If round 3 still has P0/P1, the
orchestrator sets `day-status.json` `state=fatal_blocked`,
`blocked_reason=wave_d_round_3_p1`, and exits non-zero per LOOP.md
§10.5. A human (or the next launcher run) decides whether to relax
the gate.

---

## 7. What Wave D is NOT

- **Not a replacement for any external reviewer.** External reviewers
  still run on the PR. Wave D just makes sure the PR they see is
  already clean enough that the iteration loop converges in ≤ 3
  rounds.
- **Not a design re-open.** Wave D does not re-open design. If a
  reviewer thinks the design is wrong, that's a P2 "consider
  revisiting in next forge run" finding, not a send-back.
- **Not a verify step.** Wave C verify (§7.3) runs before Wave D.
  Wave D assumes the draft has all mandatory sections and the entry
  script passes `bash -n`.
- **Not allowed to spawn children.** A Wave D reviewer that tries to
  spawn a sub-subagent is a protocol violation; the orchestrator
  kills it.
