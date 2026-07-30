# B-005 — engineer / s1

## Subagent meta
- cycle_id: cycle-001
- subagent_id: B-005
- persona: engineer
- seed: s1
- started_at: 2026-07-30T00:00:00Z
- completed_at: 2026-07-30T00:00:00Z

## Problem echoed
Structure an autonomous UX design/review loop that owns exigo's visual/interaction layer despite having no browser/screenshot capability.

## Recon findings
- `src/styles/exigo-tokens.css` exists — 72 real CSS variables (dark-only, white-on-black opacity ladder, emerald accent, four highlighter inks). Token drift is mechanically checkable against this file.
- `agents/cd-review/REVIEW-LENS.md`: fans out to 4 independent parallel reviewer subagents (each sees only its lens), writes `audits/pre-pr/{PACK_ID}-lens{N}.md`. §3.5 already has an optional `lens5 — UI / a11y` — a partial UX genome exists.
- `package.json` scripts: only `next build`, `next lint && tsc --noEmit` (`check`), vitest. No Playwright/Storybook/axe. Confirmed no-eyes.
- 16 root PNGs (`arena-v2/3/4`, `presets-migrated`, `settings-page`…) are the untracked fossil workflow.
- Real state patterns exist to lint: `isLoading`/`Skeleton`/`isPending` across `src/app/_components/exercises/`, `auth-ui.tsx`.

## Inherited constraints echoed
- none (cycle-001)

## Ideas

### I-001-041: Token-drift audit as a vitest suite
- Description: Add a vitest suite that parses `src/styles/exigo-tokens.css` into the allowed token set, then scans `src/app/**/*.tsx` for raw hex/rgb literals and off-ladder Tailwind arbitrary values (`bg-[#...]`). Fails on any color not resolvable to a token. This is the mechanical half — deterministic, no eyes needed.
- File(s) I'd modify or add: add `src/app/_components/ux/token-drift.test.ts`; reads `src/styles/exigo-tokens.css`.
- Evidence source: `vitest run token-drift` exit code + per-file violation list.
- Why it's novel: turns the design system from documentation into an executable gate.
- Riskiest assumption: raw literals are the dominant drift mode (vs. legitimate one-off gradients).
- Warrant: the token file self-describes as the single source every widget references.
- Parent idea: (none)

### I-001-042: UX lens catalogue mirroring REVIEW-LENS.md
- Description: Author `agents/ux-review/UX-LENS.md` modeled on cd-review's 4-independent-lens structure, but with UX lenses: (1) token/design-system consistency, (2) state completeness (loading/empty/error/disabled), (3) interaction affordance & focus order from JSX, (4) copy/hierarchy legibility. Each reviewer sees only its lens to prevent groupthink.
- File(s) I'd modify or add: new `agents/ux-review/UX-LENS.md` (adapts, does not edit, `agents/cd-review/REVIEW-LENS.md`).
- Evidence source: per-lens markdown audits with `file:line` citations from source reads.
- Why it's novel: reuses the proven parallel-lens genome for the perceptual domain.
- Riskiest assumption: source-only lenses catch enough without rendering.
- Warrant: cd-review §3.5 already runs a UI/a11y lens from source alone.
- Parent idea: (none)

### I-001-043: State-completeness linter (the "missing empty state" checker)
- Description: Static check that any component fetching data (uses a query hook, `isLoading`/`isPending`) also renders explicit empty and error branches. Grep-driven AST-lite scan flags components with a loading branch but no empty/error branch — the exact class of bug the fossil PNGs iterate on.
- File(s) I'd modify or add: `src/app/_components/ux/state-completeness.test.ts`; targets `src/app/_components/exercises/*.tsx`.
- Evidence source: `vitest run state-completeness` violation list.
- Why it's novel: encodes the "three states" heuristic as CI, mechanical not perceptual.
- Riskiest assumption: loading/empty/error are detectable syntactically without false positives.
- Warrant: `isLoading`/`Skeleton` patterns already exist in those files to key off.
- Parent idea: (none)

### I-001-044: Fossil-PNG intake as the review corpus manifest
- Description: A manifest `agents/ux-review/screens.json` mapping each root PNG (e.g. `settings-page.png`→`src/app/settings/`) to its source route. The loop reviews source for listed screens; the PNG is the human's last-known-good reference the human (in launcher HITL) can eyeball, not the worker.
- File(s) I'd modify or add: new `agents/ux-review/screens.json` indexing the 16 root PNGs.
- Evidence source: the PNG↔route map bounds review scope to real product surfaces.
- Why it's novel: converts the untracked fossil workflow into tracked loop input.
- Riskiest assumption: PNG filenames map cleanly to current routes.
- Warrant: §4.2 names these PNGs as evidence of the real workflow.
- Parent idea: (none)

### I-001-045: Honesty gate — verdicts require a source citation
- Description: Output-format rule (SCAMPER "eliminate"): every UX finding must carry a `file:line` citation or is dropped as unwarranted. A screen the loop cannot cite it cannot fail or pass — it emits `UNVERIFIABLE-NO-RENDER` instead of a verdict. Directly blocks rubber-stamping the perceptual half.
- File(s) I'd modify or add: output-format section of `agents/ux-review/UX-LENS.md` (I-001-042).
- Evidence source: presence/absence of citation string in each finding.
- Why it's novel: makes "I can't see it" a first-class, non-faked verdict.
- Riskiest assumption: an explicit unverifiable verdict is more useful than silence.
- Warrant: cd-review findings already mandate `code:line` citations.
- Parent idea: (none)

### I-001-046: Static a11y checks via next lint + jsx-a11y
- Description: Reuse the existing `next lint` step (`check` script) by enabling eslint-plugin-jsx-a11y rules (ships with Next's config surface). Catches missing alt text, non-interactive click handlers, label-less inputs from JSX — a11y's mechanical half — with zero new runtime tooling.
- File(s) I'd modify or add: eslint config consumed by `next lint`; no new binary.
- Evidence source: `next lint` output (part of `pnpm check`).
- Why it's novel: extracts a11y signal from a tool the repo already runs.
- Riskiest assumption: jsx-a11y is available/enable-able within current Next lint config.
- Warrant: `check` = `next lint && tsc --noEmit` already exists in package.json.
- Parent idea: (none)

### I-001-047: Design/review duality → audit→propose→gate wave shape
- Description: Attribute-listing on the two loop templates: brainstorm's α/β/γ is divergent; cd-review's audit→fix is convergent. UX needs both, so mirror cd-review: Wave A audits source through the lenses (I-001-042), Wave B proposes token/state fixes, Wave C gates via the vitest+lint suites (I-001-041/043/046). Perceptual findings stop at proposal; only mechanical ones auto-gate.
- File(s) I'd modify or add: wave-schedule scaffold in `agents/ux-review/` (structure only, not LOOP.md per §4.4).
- Evidence source: the gate wave is the vitest/lint exit codes above.
- Why it's novel: splits auto-gating (mechanical) from advisory (perceptual) by wave.
- Riskiest assumption: cd-review's convergent shape fits a partly-generative UX task.
- Warrant: cd-review LOOP.md already sequences audit→fix waves this way.
- Parent idea: (none)

## Self-report
- Ideas generated: 7
- Ideas skipped as duplicate of novelty archive: 0 (empty archive)
- Constraint violations caught and corrected: 1 (dropped an early "worker asks a human to check the PNG" idea — violates §4.4 no-HITL-in-worker; reframed I-001-044 so HITL stays in the launcher)
