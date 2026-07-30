# B-007 — outsider / s1

## Subagent meta
- cycle_id: cycle-001
- subagent_id: B-007
- persona: outsider
- seed: s1
- started_at: 2026-07-30T11:27:57Z
- completed_at: 2026-07-30T11:29:30Z

## Problem echoed
How should Exigo build an autonomous loop that owns UX quality when it has no browser eyes and only a fossil trail of hand-eyeballed PNGs?

## Inherited constraints echoed
- none (cycle-001)

## Ideas

### I-001-061: Condition-report delta against a stored reference state
- Donor domain: Museum conservation condition reports
- The analogy: A conservator never re-judges an object from scratch; they compare its current condition to a documented prior state using a fixed damage vocabulary (crazing, flaking, loss). The loop treats each screen as an accessioned object with a stored "condition descriptor."
- Description: For every product surface the loop persists a structured reference descriptor (token set, node inventory, state slots filled) captured at last-known-good. Each run serializes the current DOM/source and reports only the *delta* against that descriptor in a fixed vocabulary (token drift, missing state, hierarchy loss). No re-litigation of unchanged surfaces; the artifact is the diff, not a fresh opinion.
- Why it's novel: A software framing diffs pixels or snapshots; conservation diffs *condition against an accessioned baseline* with a controlled damage lexicon, giving stable cross-run vocabulary.
- Riskiest assumption: A source/DOM-derived descriptor captures enough "condition" that drift correlates with real UX regression.
- Warrant: The 16 `v2/v3/v4/-migrated` PNGs are exactly informal condition snapshots — the loop formalizes their comparison.
- Parent idea: (none)

### I-001-062: Punch-list walkthrough of promised affordances
- Donor domain: Architecture site-visit punch lists
- The analogy: At handover an inspector walks the building against the spec of promised deliverables, marking each item done/defect with a room location. The loop walks each screen against a declared affordance manifest, item by item.
- Description: Each surface ships a manifest of promised affordances ("primary action reachable," "loading state," "empty state," "focus visible"). The loop iterates the manifest, marking each present/absent/defective and pinning a DOM selector as the "room." Output is a defect ledger with locations, not prose — closeable item by item across runs.
- Why it's novel: Software review produces a report; a punch list produces a *binary closeable ledger keyed to location*, forcing per-item accountability.
- Riskiest assumption: Affordance presence is decidable from serialized source/DOM without rendering.
- Warrant: `src/app/_components/` is a finite shared-UI set from which per-surface manifests can be generated.
- Parent idea: (none)

### I-001-063: Plot-sampling the design system
- Donor domain: Forestry stand inventory
- The analogy: Foresters can't count every tree, so they measure fixed sample plots and extrapolate stand health with confidence bounds. The loop samples component instances instead of auditing every screen.
- Description: Rather than exhaustively review all surfaces, the loop draws a randomized sample of component instances across `src/app/`, audits those deeply, and extrapolates design-system consistency as a rate (e.g. "18% token-drift, ±5%"). Cheap, statistically defensible coverage that scales as surfaces grow.
- Why it's novel: Software instinct is exhaustive linting; forestry donates *statistical extrapolation from plots*, trading completeness for calibrated confidence under a token budget.
- Riskiest assumption: Component instances are independent enough that a sample estimates population drift.
- Warrant: The 350k/380k token kill-switch makes exhaustive review infeasible; sampling fits the budget.
- Parent idea: (none)

### I-001-064: Certify under degraded operator conditions
- Donor domain: Aviation cockpit human-factors certification
- The analogy: A cockpit control is certified reachable and legible under stress — night, vibration, gloves, task saturation — not on the calm happy path. The loop certifies each screen under its degraded data/network states.
- Description: For every surface the loop enumerates degraded conditions (slow network → loading, no data → empty, failure → error, tiny viewport) and requires each corresponding state to *exist in source* before passing. Absence of a stressed-state branch is a certification failure, addressing the mechanical half of the tension.
- Why it's novel: Software review checks the rendered happy path; human-factors certification mandates the *stressed path* as the gate, surfacing missing loading/empty/error branches.
- Riskiest assumption: Required states can be enumerated per surface and detected as source branches.
- Warrant: §4.3 names "missing loading/empty/error states" as a mechanical checkable.
- Parent idea: (none)

### I-001-065: Cue-to-cue transition review
- Donor domain: Theatre technical rehearsal (cue-to-cue)
- The analogy: A tech rehearsal skips dialogue and jumps between cues to verify every *transition* — lighting shift, scene change — lands cleanly. The loop reviews interaction edges, not static screens.
- Description: The loop models each surface as a state machine and enumerates transition edges (idle→loading→success/error, closed→open). It reviews each edge — is the change announced, is focus moved, is layout-shift bounded — treating the transition as the reviewable unit. framer-motion transitions become the cue sheet.
- Why it's novel: Software review inspects states; theatre donates *transition-as-artifact*, catching discoverability/motion defects that live between screens, not on them.
- Riskiest assumption: Transitions are recoverable from source (router + framer-motion) without runtime capture.
- Warrant: framer-motion is in the stack; transitions are declared in source.
- Parent idea: (none)

### I-001-066: Blind flight scoring of serialized screens
- Donor domain: Wine tasting blind flights
- The analogy: Judges taste blind and in randomized order against a fixed scorecard so label prestige and expectation can't bias the verdict. The reviewing persona scores screens stripped of identity and randomized in order.
- Description: The honesty gate: the review persona receives serialized DOM with screen names, git diffs, and author intent removed, and with candidate versions shuffled so it cannot rubber-stamp "the newer one." It scores against a fixed rubric vocabulary. This is structural anti-sycophancy via blinding — no second model, no human.
- Why it's novel: Software review shows the diff and the intent, inviting confirmation bias; blind flights donate *provenance-stripping + randomized order* as the debiasing mechanism.
- Riskiest assumption: A useful UX verdict survives removal of screen identity and change context.
- Warrant: §4.4 bans model-diversity and human sign-off, forcing structural anti-sycophancy — blinding is one.
- Parent idea: (none)

### I-001-067: Desire-path traces as perceptual ground truth
- Donor domain: Urban planning desire paths / walkability audits
- The analogy: The worn dirt shortcut across a lawn reveals where people actually want to walk versus where the planner laid pavement; divergence is the design signal. Instrumented interaction traces reveal where users actually go versus the designed flow.
- Description: To reach the perceptual half without eyes, the loop reads instrumentation logs (click coordinates, rage-clicks, abandoned flows, back-button spikes) already emittable from the app, and treats divergence between the designed path and the trodden path as evidence of a discoverability or hierarchy defect. Real traces, not the loop's imagination, supply the perceptual signal.
- Why it's novel: Software framing would screenshot and *guess* discoverability; desire paths donate *behavioral divergence as measured ground truth*, sidestepping the no-eyes + hallucination risk.
- Riskiest assumption: The app can be instrumented to emit interaction traces the loop can read.
- Warrant: §4.3 flags discoverability as the part where the loop "hallucinates"; traces replace guessing with measurement.
- Parent idea: (none)

## Self-report
- Ideas generated: 7
- Donor domains used: museum conservation condition reports; architecture punch lists; forestry stand inventory; aviation cockpit human-factors certification; theatre cue-to-cue rehearsal; wine tasting blind flights; urban planning desire paths
- Ideas skipped as duplicate of novelty archive: 0 (empty archive)
- Constraint violations caught and corrected: 2 (dropped an initial "restaurant health inspector re-visits" idea that smuggled a human inspector; recast the conservation idea from "photograph the object" — a browser-eyes assumption — to source/DOM descriptor delta)
