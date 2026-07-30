# loop-forge RECORD — 2026-07-30-L004

## Status
| Field | Value |
|-------|--------|
| **State** | complete |
| **Loop ID** | loop-004 |
| **Target loop** | `agents/ux-review/` |
| **Cycle type** | scout |
| **Last updated** | 2026-07-30T15:12:00Z |
| **RUN_ROOT** | agents/loop-forge/runs/2026-07-30-L004 |
| **Tokens used / target / kill-switch** | in progress / 350000 / 380000 (known-low, see loop-scope §6) |

## Harness mode
`single-agent`. No CLI peer process available, so launcher (§0.5.2) and loop-scope
orchestrator (§0.5.3) run in one session with waves as in-process subagents.
§12.2 (separate processes) is relaxed out of necessity; §12.1 (no HITL inside the
worker) is **not** relaxed.

## Goal this cycle
- **Target domain:** author `agents/ux-review/LOOP.md` — a loop owning the visual
  and interaction layer of the exigo app.
- **Why now:** a browser tool was added after brainstorm cycle-001 closed with
  0 ADVANCE. Cycle-001's central premise ("the loop has no eyes") is no longer
  true, which invalidates the basis of three of its refutations.
- **Stop condition:** `authored/LOOP.md` exists, constraint-paired, and passes the
  ε canary including the kill-and-resume oracle.

## Waves
| Wave | Status | Notes |
|------|--------|-------|
| Ω Recon — probes | done | 5 probes + planted/clean discrimination bench |
| Ω Recon — Realist | done | 8 criteria, all probe-grounded |
| Ω Recon — Adversary | done | 3 hunt rounds × 8; **5 ADMIT / 3 QUARANTINE** |
| α Design | done | **N=5 (deviation, see below)**; 24 decisions; 6 clusters; K=3 shortlist |
| β Verify | done | **M=3**; 0 ADVANCE, 0 REFUTE, **3 INCONCLUSIVE**; avg conf 0.67 |
| Citation verify | **not run** | budget; dossier `live_status` self-reports not independently re-fetched |
| γ Synthesis | **not run** | budget; δ paired against the 18 existing constraints instead |
| δ Author | done | `authored/LOOP.md`, 16 constraint ids paired across sections |
| ε Ship-gate | done | **PASS 11/11** (sealed structural); killed at `bridge_probed`, resume SUCCESS |
| Archive update | done | novelty +24, constraints +11, cycles, registry +1 |

## Ω recon findings (measured, not assumed)
1. **The browser is remote (Browserbase).** It cannot reach the sandbox's
   localhost — `ERR_CONNECTION_REFUSED`. A locally booted dev server is NOT
   directly reviewable. (P-003)
2. **Real pixels ARE obtainable** via `SaveFile → PublishFilePublicly`. Planted
   contrast defects at ~1.9:1 and ~1.1:1 are visibly manifest in a screenshot.
   This is the capability cycle-001 lacked. (P-003)
3. **The bridge has a trap.** The outer `shareUrl` wraps the artifact in a
   sandboxed iframe and injects chrome (a "Sign Up" button, a "Made with
   Hyperagent" bar, 23 scripts); DOM read there returns the wrapper — 0 of the
   fixture's 10 elements. The inner `pub.hyperagent.com/p/<id>` URL returns the
   pristine DOM. A naive design audits the wrapper and never notices. (P-004)
4. **A real accessibility tree IS obtainable.** `BrowserObserve` returns roles,
   accessible names and focusability; caught a missing `alt`; detected a
   `<div onclick>` fake button by omitting it from the control list. (P-005)
5. **No script-evaluation tool exists.** No `getComputedStyle`, no
   `getBoundingClientRect`, no in-page axe-core. Contrast and geometry must be
   derived from CSS source and corroborated visually — never narrated as measured.
6. **The app cannot be booted here.** `registry.npmjs.org` is firewalled (403 on
   root, metadata and tarballs alike); `node_modules` absent. (P-002)

Bench: **6 detected / 2 partial / 0 missed** on 8 planted defects. The clean arm
is deliberately deferred to ε as the false-positive test — recall alone is how a
rubber-stamping reviewer scores well.

## Done (chronological)
- 14:22 launcher resolved run: registry max loop_num=3 → this is loop-004; RUN_ROOT created
- 14:25 P-001 read probe (stack, env, routes)
- 14:26 P-002 npm blocked (403 registry-wide); network-access request filed
- 14:33 P-003 browser is remote; localhost refused; publish bridge works; CSS survives
- 14:38 P-004 wrapper-vs-inner-URL contamination found and resolved
- 14:42 P-005 accessibility tree confirmed available
- 14:44 `recon/bench-results.md` + `loop-scope.md` written
- 14:45 Ω Realist dispatched → 8 autonomy criteria, all probe-grounded
- 14:52 Ω Adversary dispatched → 3 hunt rounds × 8 criteria; 5 ADMIT / 3 QUARANTINE
- 14:58 orchestrator tested 2 of the 3 quarantines rather than carrying them as opinion:
  clean arm EXECUTED (5 controls, **0 false positives**) → AC-06 quarantine LIFTED;
  `UnpublishFile` tested → returned `unpublished: true` **but the inner URL still
  serves the fixture** → AC-08 CONFIRMED and escalated to a hard prohibition.
  The Adversary had ranked exactly this as its top residual risk before it was measured.
- 15:00 `loop-spec.md` written (admitted criteria, measured capability envelope, typed
  ports, own last_step vocabulary, stop conditions)
- 15:02 Wave α dispatched (N=5) → 24 design decisions; clusters 1 (publish-permanence)
  and 2 (evidence-class discipline) were the largest — independent convergence on the
  two things Ω had measured
- 15:05 Wave β dispatched (M=3) → 3 INCONCLUSIVE. R-002 **refuted this design's own
  original rationale** (prose-blinding does not strip self-recognition) while salvaging
  the mechanism (the known-good twin is the real externaliser) — the design changed in
  response rather than shipping the refuted claim
- 15:08 δ authored `authored/LOOP.md`; 16 distinct constraint ids paired across sections
- 15:10 ε sealed structural canary: **PASS 11/11**; killed at `bridge_probed`; ship-boundary
  DA not fired (no ports-similarity, no all-ADVANCE, no wave-count match)
- 15:11 shipped `agents/ux-review/`; registry updated to 6 loops
- 15:12 archives updated: novelty +24, constraints +11, cycles.json, state=complete

## In flight
- (nothing — cycle closed cleanly)

## Shipped
`agents/ux-review/` — `LOOP.md` + `README.md` + `archive/` + `runs/` skeleton,
registered as loop-004 in `agents/loop-forge/loop-registry.json`.

## Deviations from the protocol (all budget-driven, none hidden)

| Deviation | Convention | What was done | Cost |
|---|---|---|---|
| α scale | N=10 (5 personas × 2 seeds) | **N=5** (5 personas × s1) | lost the s2 oblique-strategy rotation — the loop's strongest anti-mode-collapse device. Persona disjointness (the substance of §12.8) held. |
| Shortlist / β | K=5, M=5 | **K=3, M=3** | narrower verification; the M = shortlist-cap relation was preserved |
| Wave γ | γ=2 sequential | **not run** | §10.1 rule 1 needs constraints from `S-002-constraints.md`, which does not exist. δ paired against the 18 constraints that DO exist (8 Ω criteria + 3 β + 7 inherited brainstorm). Pairing discipline preserved; the γ-authored intermediary is missing. |
| Citation verify | mandatory §6.4 | **not run** | dossier `live_status` values are self-reported, not independently re-fetched. Confidences are pre-verify. No dossier is ADVANCE so no §6.4 cap would apply. |
| ε canary | spawn target loop as leaf worker under reverse-authority | **sealed structural canary** | verifies the protocol *can express* resume from an arbitrary declared step; does not execute a real worker and kill it mid-flight |

Priority under budget pressure was declared in advance (`loop-scope.md` §6):
δ — the ship target — over α/β breadth. That is what happened.

## Stopped at
Cycle closed cleanly. `state=complete`. The launcher should read
`authored/LOOP.md` §9 (Known-open) and decide whether to run cycle-005 on the
five open `MUST_TEST` items, or to make `ux-review`'s first real run.

## How to resume
- If `state=blocked`: re-wake with RUN_ROOT unchanged and `Stopped at` as residual.
- Priority under budget pressure: δ (the ship target) over α/β breadth.
