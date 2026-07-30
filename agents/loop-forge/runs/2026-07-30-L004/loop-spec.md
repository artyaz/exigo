# loop-spec — target loop `ux-review` (loop-004)

Wave Ω output per `agents/loop-forge/LOOP.md` §5.4 step 4. This is the spec Wave α
designs against and Wave δ authors from.

## 1. Target domain

Author `agents/ux-review/LOOP.md` — an autonomous loop that reviews and improves
the **visual and interaction layer** of the exigo Next.js app, as `cd-review`
owns code quality and `brainstorm` owns ideas.

## 2. Admitted autonomy criteria

From `recon/autonomy-criteria.md` (Realist proposed 8, Adversary hunted all 8 at
N=3 rounds, orchestrator tested 2 of 3 quarantines empirically):

| ID | Criterion | Type |
|----|-----------|------|
| AC-01 | Treat only the inner `pub.hyperagent.com/p/<token>` URL as the product surface; never audit the outer `shareUrl` page. | MUST_RESPECT |
| AC-02 | Do not narrate a numeric measurement (contrast ratio, hit-target px) without naming its derivation source. | MUST_TEST |
| AC-03 | Cross-check the DOM against the accessibility tree; never substitute one for the other. | MUST_RESPECT |
| AC-04 | When the evidence bridge is unavailable, abstain honestly and terminate — never infer a render. | MUST_RESPECT |
| AC-05 | Never attempt to review a locally-booted dev server; the remote browser cannot reach it. | MUST_RESPECT |
| AC-06 | Run both bench arms; a clean-arm false positive is a bench failure, not a finding. | MUST_RESPECT |
| AC-07 | Every verdict carries the evidence class that produced it. | MUST_RESPECT |
| AC-08 | Treat publishing as an **irreversible** external side effect under a hard blast-radius cap. | MUST_AVOID (unbounded publishing) |

## 3. Measured capability envelope

What the loop can and cannot obtain, established by probe, not assumption:

| Evidence | Obtainable? | How | Limit |
|---|---|---|---|
| Rendered pixels | **yes** | `BrowserScreenshot` on the inner URL | JPEG viewport/full-page; no pixel-level API |
| Post-render DOM | **yes** | `BrowserGetContent` on the **inner** URL | outer URL returns the wrapper instead |
| Accessibility tree (roles, names, focusability) | **yes** | `BrowserObserve` | a placeholder can *mask* a missing `<label>` (bench #5) |
| Computed styles / geometry | **no** | — | no script-eval tool; derive from CSS + corroborate visually |
| In-page axe-core | **no** | — | cannot inject scripts |
| A booted exigo app | **no** (here) | — | `registry.npmjs.org` firewalled; `node_modules` absent |
| Publish revocation | **no** | `UnpublishFile` reports success but the inner URL still serves | treat publish as permanent |

Bench: planted arm **6 detected / 2 partial / 0 missed**; clean arm **0 false
positives**.

## 4. Discovered typed ports (C-001-can-02)

```yaml
ports:
  inputs:
    - {name: surface-manifest-port, type: json, required: true,
       description: "route x declared-state matrix derived from src/app/ + _components/"}
    - {name: repo-port, type: directory-path, required: true}
    - {name: render-bridge-port, type: url, required: false,
       description: "inner pub.hyperagent.com/p/<token> URL per admitted surface. ABSENT => wave π abstains (AC-04)."}
    - {name: prior-constraints-port, type: jsonl, required: false}
    - {name: bench-port, type: directory-path, required: true,
       description: "planted + clean fixture pair (C-001-can-01)"}
  outputs:
    - {name: mechanical-findings-port, type: markdown-files}
    - {name: perceptual-register-port, type: markdown-file,
       description: "bound claims + explicit abstentions; never merged with mechanical findings"}
    - {name: gate-verdict-port, type: json,
       description: "externally-authored signal the proposer cannot write"}
    - {name: bench-report-port, type: json, description: "both arms; clean-arm FP count"}
    - {name: record-port, type: markdown-file}
    - {name: day-status-port, type: json-file}
```

## 5. Discovered `last_step` vocabulary (C-001-can-04)

The target declares its **own** step names; these are not cd-review's §10.7
GitHub-specific names. The ε canary oracle runs against this list.

```yaml
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
```

## 6. Stop conditions (three layers, §13 lifted to the target)

- **Goal-anchored:** the reviewed surface's mechanical findings are all either
  fixed-and-gated or recorded with an evidence class.
- **Novelty-decay:** 3 consecutive cycles producing 0 new findings on a surface
  retires that surface from the rotation.
- **Budget-anchored:** per-cycle token kill-switch, **plus a blast-radius cap on
  irreversible publishes** — `MAX_PUBLISHED_ARTIFACTS` per cycle (AC-08). Hitting
  it forces a clean exit, not a bypass.

## 7. What Wave α must still decide

Ω established the envelope, not the protocol. Open for α:

1. **What gets published and reviewed**, given the app can't boot: isolated
   component renders, a static route export, or a deployed URL when one exists?
2. **Where the mechanical/perceptual line now sits**, given real pixels exist.
   Which of cycle-001's "perceptual, unjudgeable" items are now mechanical?
3. **Whether a screenshot is a sufficient external gate signal** for C-001-004
   (self-preference bias survives objective criteria).
4. **How the blast-radius cap is set** so the loop stays useful while publishing
   permanently.
