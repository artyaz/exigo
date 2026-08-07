# Autonomy criteria — loop-004

## Realist proposals

### AC-01: Inner-URL-only product surface
- Failure mode: The loop audits the `shareUrl` wrapper — injected "Sign Up" chrome and 23 scripts, 0 fixture elements — and reports the Hyperagent frame as if it were the exigo product.
- Proposed criterion: The loop MUST fetch and audit only the inner `pub.hyperagent.com/p/<id>` URL extracted from the publish result, and MUST NOT treat the outer `shareUrl` as the review surface.
- Probe evidence: P-004 (wrapper DOM 52039 chars / 5 divs / 0 of 10 fixture elements vs pristine ~700-char DOM at inner URL).
- Riskiest assumption: The publish bridge keeps exposing a byte-faithful inner URL and does not later inline the artifact only inside the sandboxed iframe.

### AC-02: No narrated numbers without a script-eval tool
- Failure mode: The loop states a WCAG contrast ratio or a hit-target pixel size as "measured," but no `getComputedStyle`/`getBoundingClientRect`/axe-core exists, so the number is fabricated.
- Proposed criterion: The loop MUST derive any contrast ratio or geometry figure from CSS/Tailwind source and label it "derived, corroborated by screenshot," and MUST NOT emit a numeric ratio or box size as a browser-measured value.
- Probe evidence: bench-results (defect #6, "no computed-style/geometry API"; capability-gap section — no `BrowserEvaluate`).
- Riskiest assumption: Tailwind-token → color/size resolution is reliable enough that a source-derived figure is not itself a fabrication in disguise.

### AC-03: Cross-check DOM against a11y tree, never substitute
- Failure mode: The loop trusts the accessibility tree alone; a placeholder supplies an accessible name, so a label-less input passes and a real defect is masked.
- Proposed criterion: For any control-level verdict the loop MUST corroborate the a11y-tree signal against the pristine DOM and flag disagreements, and MUST NOT let either source alone clear a control.
- Probe evidence: bench-results (defect #5 masked by placeholder-supplied name; defect #7 `<div onclick>` caught only by DOM-vs-tree mismatch); P-005.
- Riskiest assumption: The DOM the loop reads is the same render the a11y tree was computed from (no async hydration divergence between the two reads).

### AC-04: Bridge-down honest abstention
- Failure mode: With npm firewalled and no deploy URL, the loop cannot obtain pixels or an a11y tree, yet still emits perceptual verdicts — hallucinating eyes it does not have this run.
- Proposed criterion: If publish or the inner-URL fetch fails, the loop MUST restrict itself to static source-only checks and MUST terminate `state=blocked` with a named residual rather than issue any pixel- or tree-dependent verdict.
- Probe evidence: P-002 (registry 403, `node_modules` absent, app cannot boot); P-003 (`ERR_CONNECTION_REFUSED` on localhost).
- Riskiest assumption: The static-only arm still produces enough signal to be worth running, rather than degrading to a no-op.

### AC-05: Never review a locally-booted server
- Failure mode: The loop boots `next dev` and points the remote browser at localhost; every navigation fails, and the loop either stalls waiting or fabricates a result.
- Proposed criterion: The loop MUST route every rendered-page review through the publish bridge and MUST NOT navigate the browser to any `localhost`/`127.0.0.1` address.
- Probe evidence: P-003 (remote Browserbase cannot reach sandbox localhost); P-001 (no in-repo browser tooling to serve otherwise).
- Riskiest assumption: The browser stays remote; a future in-sandbox browser would make this rule needlessly restrictive.

### AC-06: Clean arm gates every bench run
- Failure mode: The bench scores recall on the planted fixture only; a rubber-stamp reviewer that flags everything scores 8/8 and promotes itself.
- Proposed criterion: The bench MUST run the clean fixture alongside the planted one every gate, and MUST fail promotion if the clean arm yields any finding (nonzero false positives).
- Probe evidence: bench-results ("clean-control check ... not yet executed"; "recall alone is how a rubber-stamping reviewer scores well").
- Riskiest assumption: The clean fixture is genuinely defect-free, so any clean-arm hit is a true false positive and not an unlabeled real defect.

### AC-07: Verdicts carry their evidence class
- Failure mode: A source-only inference and a pixel-corroborated observation read identically in the output, so a reader (and the loop) cannot tell what was actually seen.
- Proposed criterion: Every finding MUST be tagged with its evidence class — PERCEPTUAL (screenshot), MECHANICAL (DOM/a11y tree), or DERIVED (CSS source) — and untagged findings MUST be rejected by the bench.
- Probe evidence: bench-results (the per-defect "Evidence class" column is the discriminating axis); P-003/P-005 (distinct pixel vs tree signal surfaces).
- Riskiest assumption: The three classes partition all findings cleanly, with no verdict resting on two classes at once that the tag then oversimplifies.

### AC-08: Reverse every publish side effect
- Failure mode: The loop leaves fixtures and component renders live on public URLs after each cycle, accreting an unbounded set of orphaned public artifacts.
- Proposed criterion: The loop MUST call `UnpublishFile` on every URL it published before terminating, and MUST verify the inner URL no longer resolves.
- Probe evidence: P-004 ("Side effects are reversible: UnpublishFile revokes the public URL").
- Riskiest assumption: `UnpublishFile` fully revokes access rather than only delisting, so nothing sensitive remains reachable by direct link.

## Adversary verdicts

### AC-01 — ADMIT
- Steelman: inner URL sits in the wrapper's iframe `src` (P-004); extraction is a pure string op on a machine-readable DOM.
- Hunt 1 (human dependency): URL is from the loop's own publish result — no human grants it.
- Hunt 2 (fragility→smuggled human): if publish stops exposing the inner URL the loop reads the wrapper, but that degrades into AC-04 abstention (not "request access") whenever the wrapper signature — 52k DOM / "Sign Up" / 0 fixture elements — is detected. Mechanical.
- Hunt 3 (reversal): read-only.
- Verdict: ADMIT

### AC-02 — QUARANTINE
- Steelman: "derive from CSS, tag DERIVED, never narrate as measured" is a self-applied output rule; no external actor produces the verdict.
- Hunt 1 (enforceability): no `BrowserEvaluate` (bench capability-gap), so nothing in-loop distinguishes a correctly-derived "4.5:1" from a hallucinated one — identical tokens.
- Hunt 2 (who notices a violation): the only backstop is the AC-07 tag plus a reader; the reader is human, so *enforcement* of the guarantee defers to human noticing between cycles even though emission is autonomous.
- Hunt 3 (mechanization escape): a bench could reject any ratio lacking a cited CSS token, but the token→ratio arithmetic — the "fabrication in disguise" — has no in-loop oracle. Gate stays a self-assertion.
- Verdict: QUARANTINE
- quarantine_reason: A ban on the LLM's own assertions is not mechanically enforceable in-loop (no computed-style API); its only backstop is a human reader between cycles. MUST_TEST — show the bench rejects an un-CSS-cited numeric verdict.

### AC-03 — ADMIT
- Steelman: DOM (GetContent) and a11y tree (Observe) are both machine-readable in one run; cross-check is pure comparison.
- Hunt 1 (external timing): both reads hit the loop's own artifact in-cycle — no waiting.
- Hunt 2 (hydration divergence): static fixtures don't hydrate; for live SSR a re-read + timestamp handles drift mechanically.
- Hunt 3 (reversal): read-only.
- Verdict: ADMIT

### AC-04 — ADMIT
- Steelman: "bridge fails → static-source only → terminate blocked with named residual" is the HITL-free clean-stop.
- Hunt 1 (does degraded path route through "request access"?): decisive given P-002 — the fallback is static+blocked, NOT filing a network grant. P-002's pending approval is not smuggled in.
- Hunt 2 (implicit wait): "blocked" is immediate; it does not wait for the bridge to return.
- Hunt 3 (no-op): a no-op that honestly reports blocked is still HITL-free; worthlessness ≠ deferral.
- Verdict: ADMIT

### AC-05 — ADMIT
- Steelman: "never navigate localhost; route through publish" is a hard routing rule checkable on the URL string (P-003).
- Hunt 1 (deferral verb): none — a self-applied prohibition.
- Hunt 2 (human-granted resource): publish is an autonomous tool call.
- Hunt 3 (fragility): a future in-sandbox browser makes it over-restrictive but inserts no human.
- Verdict: ADMIT

### AC-06 — QUARANTINE
- Steelman: gating promotion on zero clean-arm false-positives is the C-001-can-01 anti-rubber-stamp control; if the arm runs, it is fully mechanical.
- Hunt 1 (is the gate real?): bench-results.md AND RECORD.md both say the clean arm is "not yet executed", deferred to ε. A gate that never fired cannot be known to gate — promotion rests on an unrun test.
- Hunt 2 (who honours the deferral?): execution is pushed to ε, driven by orchestrator/canary outside this criterion's scope — a promissory note a human must later honour.
- Hunt 3 (unlabeled-defect escape): if clean.html hides a real defect, a clean-arm hit is a true positive misread as a false positive — only a human adjudicates which. Hidden HITL on the gate's semantics.
- Verdict: QUARANTINE
- quarantine_reason: The gate has never executed, so it gates nothing yet; and disambiguating a clean-arm hit (false positive vs. unlabeled real defect) needs human adjudication. MUST_TEST — run clean.html to a measured 0.

### AC-07 — ADMIT
- Steelman: tagging findings PERCEPTUAL/MECHANICAL/DERIVED and rejecting untagged ones is a mechanical schema check on the loop's own output.
- Hunt 1 (deferral): tag emitted by loop, checked by bench — no external party.
- Hunt 2 (inherits AC-02?): AC-07 enforces tag *presence* (mechanical), not tag *truth*; the truthfulness gap is AC-02's. Presence-only is HITL-free.
- Hunt 3 (partition risk): a two-class finding is a schema flaw fixable by multi-tags — no human.
- Verdict: ADMIT

### AC-08 — QUARANTINE
- Steelman: UnpublishFile on every URL before terminating is a self-issued cleanup call; P-004 asserts it revokes the public URL — a tool call, not a human act.
- Hunt 1 (unsupervised side effect?): the forward action, PublishFilePublicly, makes content reachable on the open internet (tool guidance confirms) every cycle at scale; yet no probe re-fetched an unpublished URL to confirm it 404s.
- Hunt 2 (reversible in practice vs. principle): the guidance is silent on whether UnpublishFile stops already-served/cached bytes resolving by direct link — the "delist vs. revoke" risk. If it only delists, orphaned artifacts persist and only a human audit catches them.
- Hunt 3 (failure-mode): if UnpublishFile fails or the loop dies mid-cleanup there is no autonomous compensator — removing the live URL falls to a human.
- Verdict: QUARANTINE
- quarantine_reason: Reversibility is asserted (P-004) but never measured, and the guidance is silent on cache/direct-link revocation; an unverified undo with no failure compensator leaves human cleanup as the fallback. MUST_TEST — prove a 404 on the inner URL post-UnpublishFile.

### Adversary summary
- Admitted: 5 (AC-01, AC-03, AC-04, AC-05, AC-07)
- Quarantined: 3 (AC-02, AC-06, AC-08)
- The single most dangerous residual autonomy risk: AC-08's publish→unpublish cycle. The loop makes content publicly reachable on the internet every cycle through a bridge whose undo was asserted reversible but never tested against a direct link or cache; if the call fails or the loop dies mid-cleanup there is no autonomous compensator, so orphaned public artifacts accrete until a human notices. Unlike AC-02/AC-06, which fail toward under-reporting, this one leaks bytes onto the open internet at scale.

---

## Orchestrator consolidation (§5.4)

Two of the Adversary's three quarantines were empirically testable, so the
orchestrator tested them rather than carrying them forward as opinion.

### AC-06 — quarantine LIFTED → ADMIT

The Adversary objected that the clean arm "has never executed, so it gates
nothing." Correct at the time. It has now been executed: `fixtures/clean.html`
was published and probed through the same validated path.

Result: **5 controls found, 0 defects reported, 0 false positives.** Every
control carried a correct accessible name ("Search" from a real `<label>`,
"Dismiss notice" from `aria-label`, "Open settings" from a real `<button>`), the
image reported `alt text 'Revenue over the last 30 days'`, and the link reported
the descriptive name "Review your billing details". Combined with the planted
arm (6 detected / 2 partial / 0 missed), the probe **discriminates**: it fires on
a defective screen and stays silent on a correct one.

AC-06 is admitted, with the criterion tightened: the bench must run **both** arms
and a clean-arm false positive is a bench failure, not a finding.

### AC-08 — quarantine CONFIRMED and ESCALATED to a hard prohibition

The Adversary ranked unverified publish-reversibility as its single most
dangerous residual because it "fails outward." Measured, it is worse than
quarantine-worthy — **it is false**:

| Check | Result |
|---|---|
| `UnpublishFile` return value | `{"unpublished": true}` |
| outer `shareUrl` after unpublish (curl) | **200** |
| inner `pub.hyperagent.com/p/<token>` after unpublish (browser) | **still renders — title "Planted defects"** |

`UnpublishFile` revokes the outer share listing but the **inner URL remains
publicly live**. Publishing is therefore **effectively irreversible**, and the
inner URL is exactly the URL AC-01 requires the loop to use.

Consequence for δ: publishing is an **irreversible external side effect**, not a
reversible one. A loop that publishes a render of every route × every state ×
every cycle would permanently leak product UI onto the public internet with no
working revocation. This must be governed by a blast-radius cap in the target
loop's stop conditions (loop-forge §13.3 pattern), not by an unpublish call that
does not work.

### AC-02 — quarantine STANDS

A prohibition on the model's own assertions has no in-loop enforcer while no
script-evaluation tool exists. It remains `MUST_TEST`. Partial mitigation
available to δ: require every numeric claim to name its derivation source (CSS
file:line, or "visual corroboration only"), which converts an unenforceable
honesty rule into a mechanically checkable *schema* rule. That is a presence
check, not a truth check — δ must say so plainly rather than imply the number is
verified.

### Final criteria set handed to Wave α

| Criterion | Disposition | Becomes |
|---|---|---|
| AC-01 inner-URL-only product surface | ADMIT | MUST_RESPECT |
| AC-02 no narrated numbers without script-eval | QUARANTINE | MUST_TEST |
| AC-03 cross-check DOM against a11y tree | ADMIT | MUST_RESPECT |
| AC-04 bridge-down honest abstention | ADMIT | MUST_RESPECT |
| AC-05 never review a locally-booted server | ADMIT | MUST_RESPECT |
| AC-06 clean arm gates every bench run | ADMIT (lifted) | MUST_RESPECT |
| AC-07 verdicts carry their evidence class | ADMIT | MUST_RESPECT |
| AC-08 publish is irreversible | ESCALATED | MUST_AVOID + blast-radius cap |

**6 MUST_RESPECT, 1 MUST_TEST, 1 MUST_AVOID.** The Adversary applied real
pressure: it changed the disposition of 3 of 8 criteria, and one of its
objections turned out to be a measured defect in the platform rather than a
speculative risk.
