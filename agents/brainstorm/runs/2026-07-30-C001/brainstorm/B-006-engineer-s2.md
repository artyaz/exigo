# B-006 — engineer / s2

## Subagent meta
- cycle_id: cycle-001
- subagent_id: B-006
- persona: engineer
- seed: s2
- oblique_card: "Discover the recipes you are using and abandon them"
- started_at: 2026-07-30T00:00:00Z
- completed_at: 2026-07-30T00:00:00Z

## Problem echoed
Structure an autonomous UX design/review loop for a repo with no browser eyes, where the fossil PNGs at root already show the real workflow is iterate-and-eyeball.

## The recipe, named
- **Dated RUN_ROOT + monotone archive**: `agents/brainstorm/runs/YYYY-MM-DD-CNNN/` and `archive/*.jsonl` — built for append-only text that never changes on disk.
- **Wave fan-out over INDEPENDENT slices**: `agents/cd-review/REVIEW-LENS.md:49` ("Lenses are independent") + `audits/slices/S1..S11.md` — assumes quality decomposes into disjoint parallel slices.
- **Markdown-only artifacts**: `audits/slices/S<N>.md`, `RECORD.md` — the reviewable object is text a subagent authored.
- **Single-snapshot verdict**: `brainstorm/LOOP.md:43` 3-state `ADVANCE/REFUTE/INCONCLUSIVE` on one dossier — no notion of a before/after pair.
- **Decay-scored constraint memory**: `archive/constraints.jsonl` decay_score ≥ 0.3.

## Inherited constraints echoed
- none (cycle-001)

## Ideas

### I-001-051: Pair-slot RUN_ROOT (`before/` + `after/`), not a flat snapshot dir
- Description: The root fossils encode a v2→v3→v4 lineage; a UX verdict is only meaningful against a baseline. Add a run scaffold with committed `before/` and `after/` PNG slots plus a `pair.json` manifest, so every review reasons over a diff-pair, not one image.
- Recipe element abandoned: The single-snapshot artifact dir (`agents/cd-review/2026-07-18/audits/slices/`). A screen's quality is comparative, not absolute — one snapshot invites rubber-stamping.
- File(s) I'd modify or add: new `agents/ux-review/runs/<date>/pairs/<screen>/{before,after}.png` + `pair.json`.
- Why it's novel: makes before/after the atomic unit of review, which no text loop has.
- Riskiest assumption: a usable `before/` baseline exists for most screens under review.
- Warrant: the `arena-v2/v3/v4` and `-migrated` suffixes are literal before/after fossils.
- Parent idea: (none)

### I-001-052: Content-addressed image ledger, not append-only JSONL
- Description: Images are large and diff badly, so the monotone `novelty.jsonl` text-archive model breaks. Store each artifact once under `assets/<sha256>.png` and let run manifests reference the hash; the "archive" grows by reference, never by re-embedding pixels.
- Recipe element abandoned: line-oriented `archive/novelty.jsonl` growth (`brainstorm/LOOP.md:124`). Line-diffing bytes is useless and bloats git.
- File(s) I'd modify or add: new `agents/ux-review/archive/assets/` + `ledger.jsonl` (hash→path→first-seen).
- Why it's novel: separates immutable pixel blobs from mutable review text.
- Riskiest assumption: git can hold deduped PNGs without LFS at this repo's scale (root PNGs are 11–163 KB).
- Warrant: `ls *.png` shows 16 files up to 163 KB — dedup by hash is cheap here.
- Parent idea: (none)

### I-001-053: Split the wave by MECHANICAL vs PERCEPTUAL, not by disjoint slices
- Description: A screen does not decompose into independent slices the way a codebase does — hierarchy is holistic. Replace N parallel same-role reviewers with two role-typed lanes: a mechanical lane (contrast/focus-order/token-drift from source+DOM) and a perceptual lane (discoverability/hierarchy), each with its own lens file.
- Recipe element abandoned: independent-slice fan-out (`agents/cd-review/REVIEW-LENS.md:49`). §4.3's central tension is a bad fit for disjoint slices.
- File(s) I'd modify or add: new `agents/ux-review/LENS-mechanical.md` + `LENS-perceptual.md` (siblings of `REVIEW-LENS.md`).
- Why it's novel: lane split maps directly onto the checkable/perceptual fault line.
- Riskiest assumption: the two lanes stay separable and don't collapse into one reviewer's opinion.
- Warrant: §4.3 states UX quality is "partly perceptual and partly mechanical".
- Parent idea: (none)

### I-001-054: SOURCE+DOM as the eyes; verdict INCONCLUSIVE-by-default without pixels
- Description: With no Playwright (§4.2), obtain signal from what IS readable — `src/app/_components/` JSX + rendered DOM + Tailwind tokens — and gate the verdict: a perceptual claim with no attached rendered artifact caps at `INCONCLUSIVE`, never `ADVANCE`. Anti-hallucination is structural, not model-based (§4.4).
- Recipe element abandoned: the assumption that a reviewer can reach `ADVANCE` from a single authored dossier (`brainstorm/LOOP.md:43`).
- File(s) I'd modify or add: new `agents/ux-review/LOOP.md` §verdict-gate; reads `src/app/_components/`.
- Why it's novel: encodes the no-eyes constraint as a verdict ceiling, not a footnote.
- Riskiest assumption: DOM+source alone yields enough mechanical signal to be worth running.
- Warrant: §4.3 says the mechanical half "is checkable from source and DOM".
- Parent idea: (none)

### I-001-055: Perceptual constraints DON'T decay; token/a11y rules DO
- Description: Decay_score ≥ 0.3 fits fast-moving code debt but a design-system rule ("primary CTA uses token X") is a standing law. Two-tier memory: durable perceptual/design-system constraints with no decay, mechanical lint constraints keep decay.
- Recipe element abandoned: uniform decay on `archive/constraints.jsonl` (`brainstorm/LOOP.md:23`).
- File(s) I'd modify or add: new `agents/ux-review/archive/constraints.jsonl` with a `durable:true` flag.
- Why it's novel: recognizes design laws outlive code churn.
- Riskiest assumption: durable rules won't ossify and block legitimate redesigns.
- Warrant: cd-review's decay model was tuned for code, not design tokens.
- Parent idea: (none)

### I-001-056: Annotated-overlay artifact, not prose findings
- Description: Prose bullets ("nav is unclear") lose their referent on an image. Emit findings as a coordinate-anchored overlay JSON (`{bbox, severity, note}`) bound to the `after` hash, renderable as boxes on the PNG — the finding IS spatial.
- Recipe element abandoned: markdown-only audit docs (`audits/slices/S<N>.md`).
- File(s) I'd modify or add: new `agents/ux-review/runs/<date>/pairs/<screen>/findings.json`.
- Why it's novel: makes each finding independently locatable on the pixels it critiques.
- Riskiest assumption: a text agent can assign plausible bboxes without true pixel access.
- Warrant: root PNGs are whole-screen; unanchored prose can't say *where*.
- Parent idea: (none)

### I-001-057: Design/review DUALITY wave, not α→β→γ pipeline
- Description: brainstorm is diverge→verify→consolidate; cd-review is audit→fix. Neither models a designer proposing an `after` and a reviewer judging the pair. Structure as a two-role duality (Proposer emits `after/` variants; Critic scores the pair) that can iterate the fossil ladder, replacing the linear pipeline.
- Recipe element abandoned: the fixed α/β/γ pipeline shape (`brainstorm/LOOP.md:100`).
- File(s) I'd modify or add: new `agents/ux-review/LOOP.md` wave section (Proposer/Critic).
- Why it's novel: mirrors the actual generative-vs-critical duality §4.5 asks about.
- Riskiest assumption: one model role-playing both proposer and critic avoids collusion.
- Warrant: §4.5 explicitly asks whether the wave shape must differ from the two parents.
- Parent idea: (none)

## Self-report
- Ideas generated: 7
- Ideas skipped as duplicate of novelty archive: 0 (empty archive)
- Constraint violations caught and corrected: 0
