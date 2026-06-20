# Autonomous exercise-UX loop

Self-running improvement loop. Owner delegated full control (2026-06-18):
"keep yourself in a loop and don't stop, come up with improvements on your own,
this is your project now." Re-entered each wakeup via ScheduleWakeup with the
autonomous-loop-dynamic sentinel. THIS FILE IS THE MEMORY — read it first each
wakeup, then do exactly one iteration, update it, reschedule.

## North star
AI-generated exercises (open path = sandboxed iframe; markup path = Plot/Arena/
Graph) should feel hand-crafted: right-sized elements, comfortable reading
measure, zero truncation, clean alignment, consistent type scale. Pleasant to use.

## Guardrails (do not break these)
1. **One iteration per wakeup.** Small, coherent, reversible. No big rewrites.
2. **Test-gate everything.** `npx vitest run src/app/_components/exercises` must
   stay green, and `npx tsc --noEmit` must add no NEW errors (the `.next/types`
   route stubs are pre-existing noise — ignore those).
3. **No visual guessing.** Live render is auth-walled (preview hits Clerk →
   chromewebdata error; `/api/generate/open` is 401 without a session). So do
   NOT tweak pixel values blind. Prefer: regression tests, structural
   invariants, prompt/doc clarity, dead-code/consistency fixes, things provable
   without a browser. Leave pure-visual judgment calls for the owner's review.
4. **Don't auto-commit.** The whole `exercises/` module is uncommitted,
   entangled prior-session work; partial commits would break. Working tree on
   branch `auto/exercise-ux` is the workspace. Commit only if owner asks.
5. **Stay in scope:** exercise system quality. Don't wander into unrelated app
   areas, secrets, deploys, or destructive ops.
6. If you run out of safe, non-visual improvements, do a verification/hardening
   pass (tests, types, docs) rather than inventing risky changes — but keep the
   loop alive.

## Done log
- **Iter 1** (root-cause structural fix): `.x-root` 640px centered measure +
  media cap + word-wrap (toolkit.ts); open prompt layout discipline (prompts.ts);
  `.exg-ex` 760 + plot/graph svg cap 560 (styles.ts); Plot end-label fit/ellipsis
  + `<title>` (Plot.tsx). Verified bounding deterministically (900px chart → 640).
- **Iter 2** (craft polish): `svg text` 12px default, `.x-h`/`.x-grid`, margin
  resets, API doc (toolkit.ts); Arena de-chunk block 34→29 etc (styles.ts).
  123/123 tests pass, tsc clean.
- **Iter 3** (regression lock-in / backlog #1): added 2 tests to open.test.ts —
  buildOpenDoc wraps fragment in `.x-root` (640 centered) + media cap + svg-text
  12px asserted. open suite 3→5 tests, green.
- **Iter 4** (backlog #2 DONE): extracted Plot label math → display/plotLabels.ts
  (pure: labelGutter + fitLabel + PLOT_VB_W/CHAR_W/LABEL_DX constants). Plot.tsx
  now imports them; behavior identical. plotLabels.test.ts (5 tests) proves the
  invariant "fitted end-label never leaves the frame" for 1–40 char names + the
  multi-name case. 130 tests pass, tsc clean.
- **Iter 5** (backlog #4 triaged → #3-safe done): #4 = NO CHANGE — markup-path
  layout is renderer-owned (AUTHORING.md:114 "sizes/positions computed for you"),
  the model never sets width/measure/truncation in markup, so exemplars correctly
  omit it. Pivoted to #3 safe slice: added :focus-visible (keyboard a11y),
  :disabled, :active (+reduced-motion) to toolkit .x-btn/.x-card/.x-bucket,
  matching the markup path. +1 regression test. 131 tests pass.
  REMAINING #3 (spacing-scale tweaks) = visual, deferred for owner review.
- **Iter 6** (backlog #7 DONE): added open.test.ts case feeding a real-shaped
  fragment (900px chart + long-label card) through buildOpenDoc — asserts the
  whole fragment nests inside `.x-root` AND the assembled doc's <style> carries
  the max-width/media caps end-to-end (not just the exported constant). 132 green.
- **Iter 7** (backlog #6 DONE): added prefers-reduced-motion guard for the
  toolkit `.x-pop` entrance animation (was unguarded; markup path already guards
  all its keyframes). Merged into the existing reduced-motion block. +1 test. 133.
- **Iter 8** (OWNER screenshots → bug fix): owner sent 4 real markup-path renders
  flagged "very messy". Fixed the worst: `[object Object] → [object Object]` in a
  graph readout. Added `toDisplay()` in runtime/expr.ts (records → label/name/id,
  arrays joined, never "[object Object]"); routed concat (helpers.ts), string-`+`
  (expr.ts), and Display valStr/cards (Display.tsx) through it. +3 tests. 136 green.

## OWNER-REPORTED DEFECTS (screenshot-validated, 2026-06-19) — TOP PRIORITY
These outrank the old polish backlog. NOTE: #2/#3/#4 are layout/collision tuning
— make the best-reasoned fix from the screenshot evidence, but they ideally want
an owner glance at a regenerated render (live render still auth-walled for me).
- [DONE #1] readout "[object Object]" — fixed iter 8.
- [DONE #2] PLOT label garble — fixed iter 9. Added placeReadout() in
  plotLabels.ts: readout draws toward whichever side of the cursor has more room
  and is fit-with-ellipsis so it stays inside [x0,x1] and can never reach the
  right-edge label gutter. Full text rides as <title>. +3 tests. 139 green.
  (Owner should glance at a regenerated shot-2-style plot to confirm visually.)
- [DONE #3] GRAPH node/edge overlap — fixed iter 10. Rewrote Graph.place():
  rows now pack left→right by real pill width + 16px gap (was even-fraction over a
  fixed 360 viewBox → wide pills overlapped), and the viewBox widens to fit the
  widest row (centered). Applies to row + tree/layered. Edges already stop at box
  edges, so arrowheads now sit in the gap. place() exported; Graph.test.ts asserts
  no in-row overlap + viewBox growth. +2 tests. 141 green. (Owner: glance at a
  regenerated journey graph to confirm.)
- [DONE #4] ARENA chip truncation — fixed iter 11. Added uniformSizes() helper:
  when all blocks share a size (classifier; size defaults to 1), render
  `.exg-arena__block--chip` = content width + wrapping label (no ellipsis);
  varying sizes keep proportional packing (allocator). +3 tests. 144 green.

ALL FOUR OWNER-REPORTED DEFECTS FIXED (iters 8–11). Owner should regenerate the
four exercise types to confirm visually; logic is locked by tests but pixels
unverified by me (auth wall).
- **Iter 12** (consolidation/verify): FULL project suite 246 green (was 225 at
  session start, +21), tsc clean project-wide. My new code is eslint-clean
  (plotLabels/toolkit/prompts/expr-toDisplay all 0). Completed the toDisplay
  sweep: Display.tsx `tape` cells now use toDisplay (was raw String(c)) — file
  now lint-clean. OBSERVATION: the project has LARGE pre-existing eslint debt
  (validate.ts, vm.ts, helpers.ts, convexClientAuth.ts, etc. — prefer-includes,
  no-base-to-string, unnecessary-assertions). NOT my work, NOT loop scope unless
  owner asks — fixing it project-wide is a big risky change. Flagged here only.

## Backlog (ranked; pick top safe item each wakeup)
1. Regression tests locking in iter-1/2 fixes: buildOpenDoc contains `.x-root` +
   `max-width:640px`; Plot fitLabel truncation logic (extract pure helper if
   needed to make it testable).
2. Extract Plot's label-fit + PAD math into a tiny pure module + unit-test the
   "long label never exceeds gutter" invariant.
3. Audit toolkit component classes for consistency gaps (focus states, disabled
   states, spacing scale) — only changes provable as additive/safe.
4. AUTHORING.md / exemplars: ensure they reflect the new layout rules so the
   markup path teaches the same craft (read generate/exemplar.ts).
5. Markup primitives consistency pass: Graph node/edge label sizing vs Plot;
   shared type-scale constants instead of scattered px (provable refactor).
6. Add a `prefers-reduced-motion` audit across new CSS (accessibility).
7. Validate the open prompt end-to-end with a hand-written exemplar fragment fed
   through buildOpenDoc in a test (assert no overflow-prone patterns).

- **Iter 13** (OWNER bug round 2): owner sent more screenshots + DOM.
  • FIXED "slider doesn't move": a generated slider had value="1" (constant, not
    bound) → controlled input snaps the thumb back. validate.ts now ERRORS when a
    slider's `value` compiles to zero refs (constant) → repair loop rebinds it.
    +2 validate tests. 146 green, tsc clean.
  • OPEN "slightly laggy" crossover slider: value IS bound (cursorX) → perf, not
    a binding bug. Each drag round-trips VM + full plot re-render. Needs a browser
    profile — NOT guessing blind (guardrail 3). Owner-gated.
  • OBSERVED (not reported): iter-10 graph width-packing makes a 7-node row very
    wide (viewBox ~1156) → tiny text when scaled to 560. A row-wrap would fix it
    but is a visual-layout call → owner-gated, not touched blind.

- **Iter 14** (generation-side complement to iter 13): slider value-binding was
  only caught reactively by the validator (repair loop). Added the teaching at the
  source so generation gets it right first time: manifest.ts slider `describe` now
  explains binding `value` to the event's state key; AUTHORING.md adds a slider
  `value` rule + a DON'T-table row. 146 green, tsc clean, doc test still passes.

OPEN owner-gated items (do NOT touch blind): crossover slider lag (needs profile),
graph row-width→tiny-text (needs visual call), project-wide eslint debt.

## Next action — SCALED BACK (owner said "never stop", so keep looping, lighter)
All owner defects fixed + verified. Remaining work is owner-gated:
  • visual polish (old #5 type-scale, leftover #3 spacing) — needs owner pixels.
  • project-wide eslint debt — needs owner go-ahead (out of scope, risky).
So ticks are now LIGHT VERIFY-ONLY at a longer cadence (1800s): confirm tests
still green + tsc clean, and WATCH for new owner screenshots/direction — when any
arrive, that becomes top priority (like the iter 8–11 sprint). Do NOT invent
risky changes or touch visual/eslint debt blind. If a verify tick is clean and
nothing new, keep the report to one line.
