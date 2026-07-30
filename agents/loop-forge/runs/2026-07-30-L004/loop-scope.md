# loop-scope — 2026-07-30-L004

Launcher-written brief per `agents/loop-forge/LOOP.md` §0.5.2 step 2 + §4.
The orchestrator copies §3 (Target domain statement) **verbatim** into every
Wave α subagent prompt.

## 1. Meta

| Field | Value |
|-------|-------|
| Loop ID | loop-004 |
| Target loop | `agents/ux-review/` |
| RUN_ROOT | `agents/loop-forge/runs/2026-07-30-L004` |
| Cycle type | scout |
| Harness mode | single-agent (no CLI peer process; launcher + loop-scope roles in one session, waves as in-process subagents) |
| `remaining_extraction_depth` | 3 for the authored loop (it is a normal ship target, not a mid-task extraction, so §6.2's parent−1 rule does not apply) |
| Token target / kill-switch | 350,000 / 380,000 (see §6 — this estimate is known-low) |

## 2. Inherited constraints

**From `agents/loop-forge/archive/constraints.jsonl`** (loop-forge's own, filtered
to `decay_score ≥ 0.3` plus `[canonical]` which never decay) — the five canonical
invariants are binding on what δ authors:

| ID | Invariant |
|----|-----------|
| C-001-can-01 | ship a built-in discrimination test bench gating primitive promotion |
| C-001-can-02 | mandate a typed `ports:` block in every authored LOOP.md |
| C-001-can-03 | hard header-carried `remaining_extraction_depth` on every dispatch |
| C-001-can-04 | use the cd-review §0.5.4 day-status SHAPE; each forged loop declares its OWN `last_step` vocabulary |
| C-001-can-05 | LINEAGE BLOCK enforces no-self-composition + no-parent-mutation |

**From `agents/brainstorm/archive/constraints.jsonl`** (cycle-001, 7 constraints).
These are *domain evidence* for this target, not loop-forge's own constraints.
Three are now **contested by Ω recon** and that is the reason this cycle exists:

| ID | Type | Status after Ω recon |
|----|------|----------------------|
| C-001-001 | MUST_TEST | **partially settled** — a real a11y tree IS obtainable (P-005), but not from static JSX; it needs a rendered page |
| C-001-002 | MUST_TEST | still open — perceptual-citation support is unmeasured |
| C-001-003 | MUST_AVOID | **stands** — the 16 root PNGs remain stale, orphaned, route-unmappable |
| C-001-004 | MUST_AVOID | **stands, and is now satisfiable** — a screenshot + a11y tree is a signal the proposer cannot author |
| C-001-005 | MUST_AVOID | **stands** — a browser does not make LLM purpose-inference correlate with human discoverability |
| C-001-006 | MUST_RESPECT | budget: size a scout cycle nearer 650k than 350k |
| C-001-007 | MUST_RESPECT | enforce the α word cap mechanically |

## 3. Target domain statement (copied verbatim into every Wave α subagent)

### 3.1 One-sentence target domain

Author `agents/ux-review/LOOP.md` — an autonomous loop that reviews and improves
the **visual and interaction layer** of the exigo Next.js app, the way
`agents/cd-review/` owns code quality and `agents/brainstorm/` owns ideas.

### 3.2 Context

Exigo has five loops and none owns UX. Brainstorm cycle-001
(`agents/brainstorm/runs/2026-07-30-C001`) explored this exact design space with
10 personas and 65 ideas, then verdicted 5 shortlisted decisions and returned
**0 ADVANCE / 3 REFUTE / 2 INCONCLUSIVE**. Its conclusion: the mechanical half of
UX review is groundable, the perceptual half is not honestly automatable — because
the loop had no eyes.

**That premise has now changed.** A browser tool (Browserbase, remote Chromium)
was added after cycle-001 closed. Wave Ω probed it against a purpose-built
fixture with 8 planted UX defects. What is now empirically established:

- **Real rendered pixels are obtainable.** Planted 1.9:1 and 1.1:1 contrast
  defects are visibly manifest in a screenshot (P-003).
- **A real accessibility tree is obtainable.** `BrowserObserve` returns roles,
  accessible names and focusability; it caught a missing `alt`, and detected a
  `<div onclick>` masquerading as a button *by omitting it* from the control
  list (P-005).
- **The evidence path is narrow and has a trap.** The remote browser cannot reach
  this sandbox's localhost (`ERR_CONNECTION_REFUSED`), so a locally-booted dev
  server is not directly reviewable. The working bridge is
  `SaveFile → PublishFilePublicly → the inner pub.hyperagent.com/p/<id> URL`.
  The outer `shareUrl` wraps the artifact in a sandboxed iframe and injects
  chrome — a "Sign Up" button, a "Made with Hyperagent" bar, 23 scripts — so
  reading the DOM there returns the **wrapper, not the product** (P-004).
- **There is no script-evaluation tool.** No `getComputedStyle`, no
  `getBoundingClientRect`, no in-page axe-core. Contrast and hit-target geometry
  must be derived from CSS source and *corroborated* visually, never narrated as
  measured numbers.
- **The app cannot currently be booted here.** `registry.npmjs.org` is firewalled
  (403 on everything), so `node_modules` is absent (P-002).

Bench score on the planted fixture: **6 detected, 2 partial, 0 missed** — see
`recon/bench-results.md`.

### 3.3 What the design must resolve

Given real-but-narrow eyes, the open questions are:

1. **What does the loop point the browser at?** The app can't boot here, and the
   bridge only serves static published artifacts. Does the loop review published
   component renders, real deployed routes, or something else?
2. **Where does the mechanical/perceptual boundary now sit?** Cycle-001 drew it
   at "no eyes." With pixels and an a11y tree, some of what was perceptual is now
   mechanical. Say exactly which, and what remains genuinely unjudgeable.
3. **How is the gate externalised?** C-001-004 stands: self-preference bias
   survives objective criteria. A screenshot the proposer did not author is a
   candidate external signal — is it sufficient?
4. **How does the loop degrade when the bridge is unavailable?** No npm, no
   deploy URL, no publish — the loop must still terminate honestly.

### 3.4 Out of scope

- **No second LLM provider.** Anti-sycophancy must be structural.
- **No human reviewer, approver or design sign-off inside the worker.** HITL
  lives in the launcher, between cycles.
- **Do not mutate a parent loop** (`cd-review`, `brainstorm`, `loop-forge`) —
  no-parent-mutation is canonical (C-001-can-05).
- **Do not adopt the 16 root PNGs as baselines** (brainstorm C-001-003).
- **Do not claim human discoverability from LLM inference** (brainstorm C-001-005).
- **Do not assume a bootable app or an installed `node_modules`.**

### 3.5 Success shape

A complete `agents/ux-review/LOOP.md` that:

- carries a typed `ports:` block, its own `last_step_vocabulary`, a
  `remaining_extraction_depth`, and a LINEAGE BLOCK (C-001-can-02/03/04/05);
- pairs every section with a constraint it satisfies (§10.1 rule 1);
- ships a discrimination bench with **both** a planted arm and a clean arm
  (C-001-can-01 — recall alone is how a rubber-stamper scores well);
- states honestly which evidence class each verdict rests on, and abstains rather
  than narrating what it did not measure;
- passes the ε canary ship-gate including the kill-and-resume oracle.

## 4. Stop condition (goal-anchored, §13.1)

This cycle closes when `authored/LOOP.md` exists, is paired to constraints, and
the ε canary returns PASS with a successful cold-launcher resume. Backstops:
novelty-decay (§13.2) and the 380k per-cycle kill-switch (§13.3).

## 5. Wave plan

| Wave | Scale | Note |
|------|-------|------|
| Ω recon | 5 probes + Realist + Adversary | probes **done** (`recon/probe-responses.jsonl`, `recon/bench-results.md`) |
| α design | N=10 (5 personas × 2 seeds) | scoped to the browser-enabled **delta**, not a re-run of cycle-001 — §13's non-goal bans re-litigation |
| β verify | M=5 | tight external-grounding caps |
| γ synthesis | γ=2 sequential | claims → constraints |
| δ author | orchestrator solo | the ship target |
| ε ship-gate | orchestrator + 1 canary | sealed run + kill-and-resume oracle |

## 6. Known-low budget

Brainstorm cycle-001 measured α at ~4.4× and β at ~1.8× the §8.4.1 allocation and
hit its wall pre-γ. loop-forge adds Ω, δ and ε on top. The 350k figure is
therefore recorded as **known-low** (its own constraint C-001-006). If the wall is
hit, the protocol's clean-stop applies: `state=blocked` with a precise residual,
never a fabricated artifact — but δ (the ship target) is prioritised over α/β
breadth if a trade is forced.
