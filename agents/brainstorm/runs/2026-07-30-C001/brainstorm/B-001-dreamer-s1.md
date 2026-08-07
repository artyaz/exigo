# B-001 — dreamer / s1

## Subagent meta
- cycle_id: cycle-001
- subagent_id: B-001
- persona: dreamer
- seed: s1
- started_at: 2026-07-30T11:26:24Z
- completed_at: 2026-07-30T11:26:24Z

## Problem echoed
Exigo needs an autonomous loop that owns the visual and interaction layer the way cd-review owns code and brainstorm owns ideas — despite having no browser eyes.

## Inherited constraints echoed
- none (cycle-001)

## Ideas

### I-001-001: The loop grows its own eyes on first run
- Description: Instead of pretending tooling exists, the loop's opening wave is a self-equipping ritual: it detects that package.json has no Playwright/axe, then writes the install + a headless render harness as its *first deliverable*, so the loop bootstraps the very capability §4.2 says is missing. The UX review only begins once the loop has manufactured eyes for itself.
- Why it's novel: It treats the no-eyes constraint as the loop's inaugural task rather than a permanent wall.
- Riskiest assumption: The environment permits the loop to add and run new browser-automation dependencies.
- Warrant: Every other loop already writes files into the repo, so a loop that writes its own tooling is the same move aimed inward.
- Parent idea: (none)

### I-001-002: Ekphrasis — describe the screen in words, then diff the words
- Description: The loop renders each surface to a plain-language "screen-poem": a structured prose description of what a first-time user would see, reach for, and feel, generated from the DOM/JSX. It stores yesterday's poem and today's poem and reviews the *delta between descriptions*. Perceptual drift becomes a text diff a language model can actually read, sidestepping the missing image pipeline entirely.
- Why it's novel: It converts unseeable pixels into a durable, diffable natural-language artifact instead of a screenshot.
- Riskiest assumption: A prose rendering carries enough perceptual signal to catch real usability regressions.
- Warrant: The loop's native medium is language, so encoding UI as language plays to its one genuine strength.
- Parent idea: (none)

### I-001-003: The fossil-replay wave
- Description: The sixteen root PNGs (arena-v2/v3/v4, presets-migrated…) are the fossil record of a human eyeballing screens. The loop ingests these as ground-truth exemplars, reconstructs the *implied edit intent* behind each version bump (why did v3 become v4?), and turns that recovered taste into standing review criteria. The loop learns the house style from the archaeology already lying in the repo.
- Why it's novel: It mines existing accidental artifacts as a taste-training corpus rather than starting from a blank rubric.
- Riskiest assumption: The version deltas encode recoverable design intent, not random experimentation.
- Warrant: §4.2 explicitly names these PNGs as evidence about what the real workflow needs.
- Parent idea: (none)

### I-001-004: A dream-user swarm role-plays the interface
- Description: Before mechanical checks, the loop instantiates a swarm of imagined personas (the confused newcomer, the power user, the screen-reader user, the impatient one) and has each narrate their attempt to complete a task on the surface — purely from reading the code. Friction surfaces where the narrations stall or diverge. Discoverability gets probed by simulated confusion instead of by sight.
- Why it's novel: It manufactures perceptual signal from a chorus of counterfactual users rather than from rendering.
- Riskiest assumption: Simulated user narration predicts real user friction well enough to be actionable.
- Warrant: The brainstorm loop already proves multi-persona divergence produces signal a single voice misses.
- Parent idea: (none)

### I-001-005: The honesty ledger — the loop must confess its blindness
- Description: Every verdict the loop emits is forced to carry a "sight-provenance" tag: SAW (rendered pixels), READ (source only), or GUESSED (neither). A verdict tagged GUESSED cannot be an approval — it can only be a question. The loop is structurally forbidden from rubber-stamping anything it admits it never saw, because the confession is a required field.
- Why it's novel: It makes epistemic honesty a mandatory schema field rather than a hoped-for behavior.
- Riskiest assumption: Forcing a provenance tag actually changes verdicts rather than being filled in perfunctorily.
- Warrant: cd-review already gates on structured verdict fields, so a provenance field is a proven mechanism turned toward honesty.
- Parent idea: (none)

### I-001-006: The loop ships a living style-conscience, not a report
- Description: Rather than emitting a review document, the loop's output *is* a self-updating design-token conscience baked into src/app/_components/ — a tiny runtime guard that flags token drift, missing loading/empty/error states, and hit-target violations at dev time, in the editor, as the human types. The loop owns look-and-feel by living permanently inside the component layer, not by auditing it after the fact.
- Why it's novel: The deliverable is an ambient in-repo guardrail instead of a periodic verdict.
- Riskiest assumption: A useful conscience can be expressed as static/lint-time rules without a running browser.
- Warrant: The mechanical half of §4.3 (tokens, states, hit-targets) is checkable from source, exactly what a dev-time guard consumes.
- Parent idea: (none)

### I-001-007: Two loops that disagree by design — Muse builds, Critic distrusts
- Description: The loop is split into a Dreamer half that proposes bolder look-and-feel and a Skeptic half whose temperature and rubric are tuned to distrust anything it cannot see. They must reach a written truce per surface. Anti-sycophancy comes from the structural adversarial gap between the two halves — not from a second model — so the design/review duality becomes the loop's literal shape.
- Why it's novel: It embodies the design-vs-review tension as two opposed internal temperaments forced to negotiate.
- Riskiest assumption: Same-model halves can hold a genuine adversarial stance rather than collapsing into agreement.
- Warrant: §4.4 mandates structural anti-sycophancy (persona/rubric/temperature), which is exactly this split.
- Parent idea: (none)

## Self-report
- Ideas generated: 7
- Ideas skipped as duplicate of novelty archive: 0 (empty archive)
- Mutations of prior-cycle ideas: 0
- Constraint violations caught and corrected: 1 (initial draft of I-001-007 leaned on "a second reviewer signs off"; rewrote as two same-model halves negotiating, to respect §4.4 no-human-sign-off and no-second-provider)
