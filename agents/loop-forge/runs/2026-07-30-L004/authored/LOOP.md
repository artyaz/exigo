# UX Review Loop (`ux-review`)

<!-- ports-block:start — canonical per loop-forge C-001-can-02 -->
```yaml
loop_id: ux-review
parent_loops: [cd-review, brainstorm]
mutation_operator: compose
remaining_extraction_depth: 3
ports:
  inputs:
    - name: surface-manifest-port
      type: json
      required: true
      description: "route × declared-state matrix derived from src/app/ + src/app/_components/."
    - name: repo-port
      type: directory-path
      required: true
      description: "exigo repo root (read; git-write only under $RUN_ROOT and proposed fixes)."
    - name: bench-port
      type: directory-path
      required: true
      description: "planted + clean fixture pair. Both arms. C-001-can-01."
    - name: render-bridge-port
      type: url
      required: false
      description: "inner pub.hyperagent.com/p/<token> URL per admitted surface. ABSENT ⇒ wave π abstains (AC-04)."
    - name: prior-constraints-port
      type: jsonl
      required: false
      description: "inherited constraints, decay_score ≥ 0.3."
  outputs:
    - name: mechanical-findings-port
      type: markdown-files
      path: "agents/ux-review/runs/<YYYY-MM-DD-UNNN>/mechanical/M-<NNN>-<surface>.md"
    - name: perceptual-register-port
      type: markdown-file
      path: "agents/ux-review/runs/<YYYY-MM-DD-UNNN>/perceptual/P-001-register.md"
      description: "bound claims + explicit abstentions. NEVER merged with mechanical findings."
    - name: gate-verdict-port
      type: json
      path: "agents/ux-review/runs/<YYYY-MM-DD-UNNN>/gate/verdict.json"
      description: "authored by ε only. δ has no write path to it."
    - name: bench-report-port
      type: json
      path: "agents/ux-review/runs/<YYYY-MM-DD-UNNN>/bench/report.json"
      description: "both arms; clean-arm false-positive count is the disqualifier."
    - name: record-port
      type: markdown-file
    - name: day-status-port
      type: json-file
last_step_vocabulary:
  - init
  - surface_manifest_written
  - bench_both_arms_passed
  - bridge_probed
  - mu_dispatched
  - mu_consolidated
  - pi_dispatched
  - pi_registered
  - delta_authored
  - epsilon_gated
  - record_finalized
  - scope_complete
lineage:
  parent_loops: [cd-review, brainstorm]
  mutation_operator: compose
  no_self_composition: true
  no_parent_mutation: true
  founder: false
```
<!-- ports-block:end -->

Continuous **survey → mechanical audit → perceptual register → propose → gate**
loop for the visual and interaction layer of the exigo app.

This is the **perceptual** counterpart to `agents/cd-review/` (critical, code) and
`agents/brainstorm/` (divergent, ideas). Where cd-review asks "is this code
correct and clear?", ux-review asks "is this screen legible, reachable, and
consistently built?" — and is rigorously honest about which of those it can
actually establish.

Dated run artifacts live under `agents/ux-review/runs/YYYY-MM-DD-UNNN/`
(`U` prefix = UX run, disambiguating from cd-review's date-only, brainstorm's `C`
and loop-forge's `L`).

---

## 0. Provenance — why this loop is shaped the way it is

Every section below is paired with exactly one constraint it satisfies
(loop-forge §10.1 rule 1). Constraint sources:

- **AC-01…AC-08** — autonomy criteria discovered by loop-forge Wave Ω and
  adversarially hunted. See `agents/loop-forge/runs/2026-07-30-L004/recon/autonomy-criteria.md`.
- **BR-001…BR-003** — Wave β constraints. See `.../research/_summary.md`.
- **C-001-00x** — inherited from brainstorm cycle-001. See `agents/brainstorm/archive/constraints.jsonl`.

**The one-paragraph history.** Brainstorm cycle-001 explored this design space
with 65 ideas and returned **0 ADVANCE**, concluding the perceptual half of UX
review was not honestly automatable — because the loop had no eyes. A browser was
then added. Wave Ω measured what it actually provides: **real rendered pixels
and a real accessibility tree, yes**; computed styles, geometry and in-page
axe-core, **no**; and publishing, which is the only way to get a render in front
of the browser, is **irreversible** (`UnpublishFile` reports success while the
inner URL keeps serving). This loop is the honest shape of what remains possible.

---

## 1. North-star and non-goals

### North-star (ordered)

| # | Criterion | Paired constraint |
|---|-----------|-------------------|
| 1 | **Evidence honesty** — no verdict exceeds the evidence class that produced it | AC-07 |
| 2 | **Bounded permanence** — irreversible publishes stay under a hard cap | AC-08 |
| 3 | **Discrimination** — the loop fires on defects and stays silent on correct screens | AC-06 / C-001-can-01 |
| 4 | **Externalised judgement** — the proposer never authors its own gate | C-001-004 / BR-002 |
| 5 | **Cumulative narrowing** — perceptual items migrate to mechanical rules over time | AC-02 |

### Non-goals

- **Human review inside the worker.** HITL lives in the launcher, between runs.
- **Claiming human discoverability.** An LLM's inability to name a screen's
  purpose is not evidence a person would struggle (**C-001-005**, refuted at
  0.68 confidence with primary sources).
- **A second LLM provider.** Anti-sycophancy is structural.
- **Beauty judgements.** This loop never scores aesthetics. It has no instrument for it.
- **Adopting the 16 root PNGs as baselines** (**C-001-003**) — they are stale,
  orphaned and route-unmappable.
- **Reviewing a locally-booted dev server** (**AC-05**) — the remote browser
  cannot reach localhost; measured `ERR_CONNECTION_REFUSED`.

---

## 2. The evidence-class taxonomy (load-bearing)

*Pairs with AC-07 and AC-02.*

Every finding is a typed record. The class determines what may be asserted:

| Class | Derived from | May assert | May NOT assert |
|---|---|---|---|
| `MECHANICAL-DOM` | post-render DOM at the inner URL | presence/absence, nesting, attributes, heading order | anything visual |
| `MECHANICAL-CSS` | CSS / design-token source, cited `file:line` | numeric contrast, declared px sizes | that the number was observed in the render |
| `A11Y-TREE` | `BrowserObserve` roles / accessible names / focusability | control naming, focusability, landmark structure | that a name is *good*, only that it exists |
| `PERCEPTUAL-PIXELS` | screenshot | pixel-decidable facts: present, clipped, overlapping, illegible-relative-to-reference | **any number** |

**Hard rule (AC-02):** a `PERCEPTUAL-PIXELS` finding that states a numeric value
is a **schema violation** and is rejected unwritten. Numbers live only in
`MECHANICAL-CSS`, and must name their derivation source.

**Honest limit, stated plainly:** this is a *presence* check on the derivation
source, not a *truth* check on the number. No script-evaluation tool exists, so
nothing inside the loop can verify a computed ratio. AC-02 remains `MUST_TEST`,
and this loop does not pretend otherwise.

**Never sum across classes.** There is no aggregate "UX score" — mechanical and
perceptual findings route to disjoint ports. Averaging a deterministic count with
an unverifiable judgement launders the second into the first.

---

## 3. Wave structure

```text
σ  SURVEY (deterministic, no LLM judgement)          [AC-05]
   Build route × declared-state manifest from src/app/ + _components/.
   Emit one standalone HTML harness per admitted surface: the surface's markup
   linked against the real design tokens. No React runtime, no node_modules,
   no dev server — this is the fixture shape Ω validated end to end.
        │
        ▼
βench  BOTH ARMS GATE                                 [AC-06, C-001-can-01]
   Run planted + clean fixtures through the full evidence path.
   Planted arm must detect every planted defect; clean arm must report ZERO.
   A clean-arm false positive is a BENCH FAILURE, not a finding.
   A "partial" detection counts as a MISS. Bench fails ⇒ the run stops here.
        │
        ▼
μ  MECHANICAL AUDIT (N parallel, disjoint surfaces)   [AC-03, BR-001]
   Repo-first: every check statically derivable from source —
   heading order, missing alt, <label for>, <div onclick>, token contrast,
   declared hit-target px. Each finding cites file:line.
   DOM × a11y-tree cross-check: a finding fires on agreement, or on
   informative DISAGREEMENT (a placeholder masking a missing label; a
   div-with-onclick absent from the control list). Single-source claims are
   auto-demoted to the perceptual register. Never substitute one for the other.
        │
        ▼
π  PERCEPTUAL REGISTER (abstain-by-default)           [AC-01, AC-04, BR-003]
   Only surfaces carrying a residual claim that source alone cannot settle earn
   a publish. Publish ONE batched contact sheet; screenshot each section
   separately. Read only the inner pub URL — never the outer shareUrl.
   Bridge absent ⇒ abstain and record; never infer a render.
        │
        ▼
δ  PROPOSE (mechanical findings only)                 [AC-07]
   Author fixes only for findings whose evidence class supports them.
        │
        ▼
ε  GATE (externalised; δ has no write path)           [BR-002, C-001-004]
   Score the surface against its known-good twin, blind to which is which.
   A gate that cannot distinguish them is a bench failure, not a pass.
   Plus the objective signals the proposer cannot author: `npm run check`,
   `npm run test` exit codes.
```

### 3.1 Why triage is bounded, not trusted (BR-001)

R-001 returned INCONCLUSIVE at 0.62 and bounded the mechanism. Static source
analysis has high coverage for contrast, `alt`, heading order and `label-for`,
and approximately **zero** coverage for focus-visible, keyboard operability and
meaningful sequence. Therefore:

> Triage may **auto-clear** a surface only for the statically high-coverage
> classes. Any surface with focus, keyboard or sequence relevance **must** reach
> the batched publish even when source looks clean, and each published section
> gets its own screenshot pass.

### 3.2 Why the gate leans on the twin, not on blinding (BR-002)

R-002 returned INCONCLUSIVE at 0.72 and **refuted this loop's original
rationale**, which is why the design changed. Withholding the proposer's prose
does *not* strip self-recognition, because recognition rides on content, not
presentation. The load-bearing externaliser is therefore the **known-good twin
comparison**, not prose-blinding. This loop does not claim prose-withholding as
its defence.

### 3.3 Why the acuity ladder is a proxy, not a measurement (BR-003)

R-003 returned INCONCLUSIVE at 0.66. A comparative ladder is *safer* than a
fabricated ratio, but VLM run-to-run consistency on fine visual comparison is
unproven. Therefore every ladder read is labelled a **legibility proxy, never a
WCAG ratio**, the loop must abstain on run-to-run disagreement, and consistency
must be demonstrated on a fixed capture before any ladder read is trusted.

---

## 4. Blast-radius: publishing is permanent

*Pairs with AC-08 — the measured finding, not a precaution.*

`UnpublishFile` returned `{"unpublished": true}` while the inner URL continued to
serve the artifact. Publishing is therefore **irreversible in practice**.

- `MAX_PUBLISHED_ARTIFACTS` (default **3** per run) is a **monotonic pre-flight
  counter**: reserve a slot, then publish. It is **never credited back**.
- `UnpublishFile` **must not appear in any success path**. A loop that trusts it
  publishes freely and leaks permanently.
- A content-hash guard skips re-publishing an unchanged harness, so retries never
  burn the cap.
- Batching (§3, wave π) means N surfaces cost exactly **1** permanent artifact.
- Exhausting the reserve forces `scope_complete` clean exit — never a bypass.

---

## 5. Resume contract

*Pairs with C-001-can-04.* `day-status.json` uses the cd-review §0.5.4 **shape**;
the `last_step` values come from **this loop's own** `last_step_vocabulary`
(header), not cd-review's GitHub-specific names.

```json
{
  "state": "running|surveying|benching|auditing|registering|proposing|gating|blocked|complete",
  "run_id": "ux-001",
  "phase": "sigma|bench|mu|pi|delta|epsilon|done",
  "last_step": "<one of last_step_vocabulary>",
  "surfaces_pending": 0,
  "published_artifacts_used": 0,
  "published_artifacts_cap": 3,
  "bench_planted_pass": null,
  "bench_clean_fp_count": null,
  "gate_verdict": null,
  "blocked_reason": null,
  "updated_at": "ISO-8601"
}
```

`day-status.json` is written **before every side effect** — especially before
every publish, since publishes cannot be undone. `day-status.json` + `RECORD.md`
"Stopped at" is the only resume contract.

---

## 6. Stop conditions (three layers)

1. **Goal-anchored** — every mechanical finding on the surveyed surfaces is either
   fixed-and-gated or recorded with its evidence class.
2. **Novelty-decay** — 3 consecutive runs with zero *new deduplicated findings*
   (keyed surface + control + evidence class) retires that surface. Explicitly
   **not** keyed on pixel or JPEG hash: a re-render differs byte-wise every time,
   so an image-keyed signal would never decay.
3. **Budget-anchored** — per-run token kill-switch, **plus**
   `MAX_PUBLISHED_ARTIFACTS` (§4). Either forces a clean exit.

Plus: **bench failure halts the run** before any surface is reviewed.

---

## 7. The 8 invariant rules of autonomy

Adapted from cd-review / brainstorm / loop-forge §12.

1. **No human in the loop inside the worker.** Continue, ship, or leave
   `Stopped at` + `day-status.json`.
2. **Launcher and worker are separate processes**; the launcher polls status
   files only, never the worker's transcript.
3. **`day-status.json` + `RECORD.md` "Stopped at" is the ONLY resume contract**,
   against this loop's declared `last_step_vocabulary`.
4. **One-directional wave separation.** σ does not audit; μ does not perceive; π
   does not propose; δ does not gate; ε does not author content.
5. **The gate is never authored by the proposer.** δ has no write path to
   `gate-verdict-port`.
6. **Both bench arms run, every run.** Recall without a false-positive arm is how
   a rubber-stamper scores well.
7. **Single source of truth.** `LOOP.md` is canonical; `runs/` folders are
   immutable; `archive/` is the only cross-run memory.
8. **Publishing is permanent and capped.** No success path calls `UnpublishFile`.

---

## 8. Lineage

*Pairs with C-001-can-05.*

- **Parent loops:** `cd-review` (critical genome: slice fan-out, objective
  exit-code gate, RECORD + day-status resume contract), `brainstorm` (persona
  diversity, 3-state verdicts, decay-scored constraint archive).
- **Mutation operator:** `compose`.
- **`remaining_extraction_depth`:** 3.
- **no-self-composition:** `ux-review` may not compose with itself.
- **no-parent-mutation:** this loop must never edit `cd-review`, `brainstorm` or
  `loop-forge`. It borrows their patterns; it does not modify them.

## 9. Known-open (do not read this loop as settled)

All three β verdicts were **INCONCLUSIVE** — none ADVANCE. This loop is
shippable because each mechanism is scoped to what its evidence supports, not
because the mechanisms are verified.

| Open item | Constraint | What would settle it |
|---|---|---|
| Can a numeric claim's honesty be enforced in-loop? | AC-02 `MUST_TEST` | a script-evaluation tool, or a measured non-supporting-citation rate |
| Does the known-good twin actually defeat self-preference? | BR-002 `MUST_TEST` | A/B: artifact-only vs artifact+prose gate scoring |
| Are ladder / scale-bar reads run-to-run stable? | BR-003 `MUST_TEST` | repeated reads of one fixed capture + a coarse known reference set |
| Does triage skip render-only defects? | BR-001 `MUST_TEST` | run both paths on a focus/keyboard-heavy surface and compare |
| Can the app be booted and route-exported? | — | `registry.npmjs.org` access; then `next build` |

A future run that resolves any of these should update this table and the paired
section together — never one without the other.
