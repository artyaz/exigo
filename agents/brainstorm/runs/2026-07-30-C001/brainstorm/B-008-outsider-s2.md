# B-008 — outsider / s2

## Subagent meta
- cycle_id: cycle-001
- subagent_id: B-008
- persona: outsider
- seed: s2
- oblique_card: "Remove specifics and convert to ambiguities"
- started_at: 2026-07-30T11:28:14Z
- completed_at: 2026-07-30T11:29:40Z

## Problem echoed
Exigo needs an autonomous UX design/review loop that produces honest, reviewable signal about screens it cannot see, reading only source and DOM structure.

## Seed reframe echoed
Instead of feeding the loop a spec/rubric to grade against, I withhold intent from the reviewer and treat the gap between its *guessed* purpose and the artifact as the finding.

## Inherited constraints echoed
- none (cycle-001)

## Ideas

### I-001-071: The blind sommelier flight
- Donor frame: Blind wine tasting (label concealed; taster names varietal/region from the glass alone).
- The analogy: A sommelier deprived of the label must name the wine from structure — tannin, acid, nose. A reviewer deprived of the route/page name must name the screen's purpose from DOM structure alone.
- Description: Strip filenames, route paths, comments, and copy strings from a rendered component tree; hand the reviewer only the anonymized element/role/nesting skeleton. Ask it to declare "this screen is for X, primary action Y." Then reveal ground truth. Divergence between blind-guessed purpose and actual purpose is scored as a legibility/discoverability defect localized to the ambiguous nodes.
- What is deliberately withheld: the screen's name, route, and prose — because if purpose only survives in the label, the *structure* failed to communicate it.
- Why it's novel: it grades intent-recoverability from anonymized structure, not conformance to a rubric.
- Riskiest assumption: a component tree stripped of copy still carries enough signal for a meaningful purpose-guess.
- Warrant: the 16 root PNGs (`arena-v2..v4`) show iteration on *what a screen communicates at a glance* — exactly the recoverable-purpose property this measures.
- Parent idea: (none)

### I-001-072: Kim's Game recall of a screen
- Donor frame: Scout-craft "Kim's Game" — objects shown briefly, then recalled from memory.
- The analogy: A scout who saw a tray for ten seconds recalls the salient items and forgets clutter; salience predicts what survives memory. A reviewer given a tree once, then asked to reconstruct it, reveals which affordances are structurally salient.
- Description: Feed the DOM once. Discard it. Ask the reviewer to reconstruct the screen's affordances from memory-of-structure (heading depth, landmark count, repeated patterns). Elements that a single structural pass cannot recall are flagged as low-prominence — a candidate hierarchy defect where the primary action is buried among equally-weighted siblings.
- What is deliberately withheld: a second look — forcing reliance on first-pass structural salience, the same salience a real user's glance gets.
- Why it's novel: models "glanceability" mechanically as reconstruction fidelity, no screenshot needed.
- Riskiest assumption: structural salience (DOM prominence) correlates with perceptual salience.
- Warrant: §4.3 names information-hierarchy as the perceptual half that resists checking; recall-fidelity is a structural proxy for it.
- Parent idea: (none)

### I-001-073: Stranger navigating an unlabeled building
- Donor frame: Wayfinding research — a stranger dropped in a building with no signage, timed to a goal.
- The analogy: An architect tests wayfinding by removing signs and watching where strangers hesitate. A reviewer given a goal but denied route names must "walk" the component graph to reach the target action; hesitation = branch points with ambiguous next-steps.
- Description: Build the app's navigation as a graph from routing + link/button structure. Give the reviewer a task ("reach checkout") but withhold all human-readable labels — only structural edges. Count decision points where no structural cue disambiguates the correct edge. High ambiguity = poor discoverability of that path.
- What is deliberately withheld: link text and page titles — so only structural affordance guides navigation, exposing paths that work only because copy rescues them.
- Why it's novel: measures path discoverability as graph ambiguity, independent of eyes or copy.
- Riskiest assumption: the routing/link graph is extractable statically with enough fidelity.
- Warrant: surfaces list (`playground`, `spaces`, `checkout`…) in §4.2 is a real multi-step nav graph to traverse.
- Parent idea: (none)

### I-001-074: Archaeology of the version strata
- Donor frame: Stratigraphy — reading site history from undated layers, no written record.
- The analogy: An archaeologist infers what mattered from what was rebuilt most, reading strata with no text. The `v2/v3/v4/-migrated` PNG suffixes are literal strata; churn-per-screen infers where design intent was least stable.
- Description: Treat file/commit churn on each surface as sediment. Withhold any stated design intent; infer "contested" screens purely from rebuild frequency and diff volatility of their component trees. Rank surfaces by instability; the loop's attention budget goes to high-churn screens, on the inference that repeatedly-rebuilt screens hide unresolved UX problems.
- What is deliberately withheld: any human account of *why* a screen changed — because the churn pattern itself, uncontaminated by rationalization, points to instability.
- Why it's novel: prioritizes review targets by inferred instability, not a fixed checklist order.
- Riskiest assumption: rebuild frequency tracks unresolved UX problems, not mere feature growth.
- Warrant: §4.2 explicitly calls the PNG suffixes "the fossil record" — this reads that record directly.
- Parent idea: (none)

### I-001-075: Double-blind placebo screen
- Donor frame: Double-blind RCT — neither arm knows if it got drug or placebo.
- The analogy: A trial guards against belief-driven scoring by hiding which arm is which. Insert a deliberately-broken "placebo" variant among real screens, hidden from the reviewer, to catch rubber-stamping.
- Description: For each review batch, the harness silently injects a mutant screen (removed loading state, scrambled focus order, orphaned primary action) alongside real ones, with the reviewer blind to which is planted. If the loop passes a planted defect, its verdicts that cycle are marked low-confidence and re-run at higher scrutiny. The planted-defect catch-rate becomes the loop's honesty meter.
- What is deliberately withheld: which artifact is the planted control — denying the loop the ability to relax on "known-good" inputs.
- Why it's novel: it's a structural anti-rubber-stamp mechanism (§4.4-safe: no second model, no human) built from blinding.
- Riskiest assumption: planted defects are representative enough that catch-rate generalizes to real misses.
- Warrant: §4.5 demands "what stops the loop from rubber-stamping a screen it cannot see" — a blind positive-control answers exactly that.
- Parent idea: (none)

### I-001-076: Ethnographer with no phrasebook
- Donor frame: Ethnography of an unfamiliar culture with no shared language.
- The analogy: An ethnographer denied translation infers meaning from repetition, ritual, and what co-occurs. A reviewer denied the design-system docs infers the system from recurring class/token co-occurrence patterns.
- Description: Withhold the design-system spec entirely. Let the reviewer induce the *de facto* system from statistical regularities in Tailwind token usage across components — which spacings, colors, radii co-occur as a "grammar." Then flag any component whose token combination is an outlier against the induced grammar as drift. The norm is discovered, not declared.
- What is deliberately withheld: the canonical token spec — so drift is measured against actual practice, catching cases where the spec itself is dead/ignored.
- Why it's novel: token-drift detection without a design-system source of truth; the norm is inferred bottom-up.
- Riskiest assumption: statistical token regularities form a coherent enough grammar to call outliers.
- Warrant: §4.2 gives Tailwind v4 + shared `_components/`; §4.1 names design-system consistency as in-scope.
- Parent idea: (none)

### I-001-077: The redacted brief (steganography of intent)
- Donor frame: Redaction analysis — inferring a document's content from the shape of what's blacked out.
- The analogy: An analyst reads a redacted memo by the length and position of the black bars. A reviewer given only the *shape* of a screen's states (which of loading/empty/error/success exist as code branches) infers whether the intended experience is complete from the holes.
- Description: Reduce each screen to a redacted skeleton: presence/absence of state branches, conditional renders, and async boundaries — all identifiers blanked. The reviewer reasons purely about the negative space: "a data screen with a success branch but no empty/error branch has a redacted hole where a state should be." Missing-state defects surface from the shape of omissions, not from a checklist of required states.
- What is deliberately withheld: all identifiers and copy — leaving only the topology of states, so gaps announce themselves structurally.
- Why it's novel: derives missing-state findings from negative space rather than matching against a required-states list.
- Riskiest assumption: state branches are reliably distinguishable in source (vs. states handled implicitly or upstream).
- Warrant: §4.3 lists "missing loading/empty/error states" as mechanically checkable — this checks them by shape-of-omission.
- Parent idea: (none)

## Self-report
- Ideas generated: 7
- Ideas skipped as duplicate of novelty archive: 0 (empty archive)
- Constraint violations caught and corrected: 2 (dropped an early "human tester walks the app" framing → recast as agent-walked graph in I-001-073; dropped a "second grader model" honesty check → recast as blind positive-control in I-001-075)
