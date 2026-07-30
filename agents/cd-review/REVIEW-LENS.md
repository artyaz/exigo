# Wave D — Pre-PR subagent review lens catalogue

This file is the **single source of truth** for Wave D reviewers (the pre-PR
internal review stage defined in `LOOP.md` §7.5). Wave D runs **after** Wave C
verify and **before** the ship protocol (§10.2). Its job is to produce a
CodeRabbit-quality review of the staged diff so the orchestrator can either
send the pack back to Wave C (P0/P1 residual) or open the PR with confidence.

Wave D reviewers are **subagents** of the day-scope orchestrator. They do not
edit product code. They do not spawn children. They write one file each to
`$RUN_ROOT/audits/pre-pr/{PACK_ID}-lens{N}.md` and the orchestrator
consolidates into `$RUN_ROOT/audits/pre-pr/{PACK_ID}.md`.

---

## 0. Why a pre-PR stage at all

CodeRabbit reviews land **after** the PR is open. If the PR has a real
correctness/auth/security flaw, that flaw is now in the open PR history, on
the `develop` branch, and visible to anyone watching the repo. A 5-minute
internal review by N parallel subagents — each looking through a different
lens — catches the bulk of P0/P1 issues before the PR exists, which means:

- fewer force-pushes to `develop` to fix post-CodeRabbit nits
- fewer `@coderabbitai review` re-trigger cycles
- fewer "review skipped, please re-open" round trips
- a cleaner main-PR diff for CodeRabbit to chew on, so its findings are
  higher-signal and the iteration cap (§10.2 step 4) is reached faster

Wave D is **not** a replacement for CodeRabbit. It is a cheap, parallel,
in-process pre-filter that reduces the number of CodeRabbit iterations needed.

---

## 1. Lenses

Each Wave D dispatch fans out to **four** reviewer subagents, one per lens.
The orchestrator MAY add a fifth lens (`lens5`) for very large packs with
non-trivial UI changes; otherwise lens 5 is skipped.

| Lens | Focus | Looks at |
|------|-------|----------|
| **L1 — Correctness & security** | Auth, secrets, races, input validation, error leakage, plan-limit bypasses, Convex authz | All touched TS/TSX in `convex/**`, `src/app/api/**`, `src/server/**`, `src/lib/**`, `shared/**` |
| **L2 — Readability, clarity, brevity** | Naming, dead code, god functions, liar comments, copy-paste, north-star score per finding | All touched files |
| **L3 — Consistency with repo conventions** | AGENTS.md rules (dual AI paths, SSE dialect, prompt registry, shared/-for-cross-runtime, plan SSOT), neighboring-file patterns | All touched files + 1–2 neighbor files for sibling-consistency check |
| **L4 — Tests & edge cases** | Coverage of new branches, boundary conditions, regression risk, missing assertions, snapshot drift | Touched `*.test.ts`/`*.test.tsx` + product code that should have tests |
| L5 (optional) — UI / a11y | Keyboard traps, focus loss, ARIA, color contrast, layout shift, hydration mismatch | Touched `_components/**`, `app/**/page.tsx`, `app/**/layout.tsx` |

Lenses are **independent**: each reviewer sees only its lens brief, the
staged diff for its owned files, `AGENTS.md`, and `.coderabbit.yaml`. They do
not see each other's output. The orchestrator consolidates.

---

## 2. Reviewer brief template

```text
You are a WAVE D pre-PR reviewer for Exigo cd-review, lens {N} ({LENS_NAME}).
RUN_ROOT={RUN_ROOT}
PACK={PACK_ID}
LENS={N}
OWNED FILES: {owned files for this pack}

INPUT YOU MUST READ
- agents/cd-review/LOOP.md §7.5 (your role and acceptance gate)
- agents/cd-review/REVIEW-LENS.md §3 (lens {N} checklist) and §4 (output format)
- AGENTS.md (Exigo conventions you are enforcing)
- .coderabbit.yaml (path filters + path instructions CodeRabbit will apply)
- The staged diff for this pack:
    git -C {REPO_ROOT} diff develop...HEAD -- {OWNED_FILES}
- The commit context:
    git -C {REPO_ROOT} log develop..HEAD --oneline -- {OWNED_FILES}
- The Wave C fix report (what the pack claims to do):
    {RUN_ROOT}/audits/fixes/{PACK_ID}.md
- Optional: the brainstorm package the pack executes, for design context:
    {RUN_ROOT}/brainstorms/{BRAIN_ID}.md

LENS {N} FOCUS
{LENS_SPECIFIC_INSTRUCTIONS_FROM_SECTION_3_BELOW}

RULES
- Do NOT edit product code.
- Do NOT spawn subagents.
- Do NOT re-open design — Wave B already chose the approach. You review the
  implementation, not the design.
- Read EVERY line of the diff. A skim is a failure.
- For each finding, give: severity, file:line, what is wrong, why it hurts the
  north star or a CodeRabbit-equivalent concern, and a concrete suggested fix
  (a 1–3 line patch, not a redesign).
- If you find nothing actionable, say so explicitly with a "clean bill" note
  listing the 3–5 riskiest lines you examined and why they are OK. Empty
  praise is failure; an unjustified clean bill is also failure.

OUTPUT — write {RUN_ROOT}/audits/pre-pr/{PACK_ID}-lens{N}.md using the format
in REVIEW-LENS.md §4. Return to the orchestrator: severity counts + top 3 +
list of finding IDs.

ACCEPTANCE GATE (orchestrator applies, you do not decide)
- P0 or P1 findings → pack goes back to Wave C.
- P2 findings → orchestrator fixes or accepts with reason in RECORD.
- P3 nitpicks → accept with reason, or batch-fix if cheap.
See LOOP.md §7.5.3 for the consolidation rule.
```

---

## 3. Per-lens checklists

### 3.1 Lens 1 — Correctness & security

Adversarial stance: **assume the diff is wrong until proven correct.** Apply
all of these to every touched function:

- **Authz on every Convex path**: every `mutation`/`action`/`query` that
  touches user data must go through `getAuthedContext` or `withAuth`. No
  client-trusted `userId`, `role`, `spaceId`, `accessLevel`. Check that the
  `AuthedContext` is actually used (not just fetched and ignored).
- **Authz on every Next API route**: every handler under `src/app/api/**`
  must call `auth()` and pass through `convexClientAuth`. No route that
  mutates Convex data accepts a `userId` from the request body.
- **Plan limits**: any new mutation that creates a metered entity (test,
  deep dive, knowledge piece, space) must enforce `LIMITS_BY_TIER`. A
  missing gate is a P0.
- **Secret leakage**: error messages, SSE error frames, PostHog events, and
  logs must not include `GOOGLE_GEMINI_API_KEY`,
  `EXIGO_SERVER_MUTATION_SECRET`, `PADDLE_CONVEX_WEBHOOK_SECRET`, Clerk
  session tokens, or user BYOK keys. Opaque error strings only.
- **SSE error frames**: must use the majority dialect
  `data: {"type":"error","message":...}` from `src/lib/sse.ts`. A new
  ad-hoc error shape is a P1.
- **Race conditions**: any "claim" / "lock" / "steal" path must use a
  server-side conditional write (Convex `patch` with a guard, or a
  generation counter). Client-side check-then-write is a P0/P1.
- **Input validation**: every external input (request body, query param,
  Convex argument) must be validated with `zod` or Convex `v.*` validators.
  Loose `v.any()` or `as any` on the boundary is a P1.
- **Convex authz edge cases**: `default_user` must NOT bypass space access
  checks (see P10-A). Cross-tenant reads/writes are P0.
- **`async`/`await` correctness**: missing `await` on a Convex call, a
  `db.query`, a `fetch`, or a `provider.generate` is a P1 (silent drop).
- **Error swallowing**: `try { ... } catch (e) { /* nothing */ }` without
  a documented reason is a P2.

### 3.2 Lens 2 — Readability, clarity, brevity

Apply the north-star in order: readable → clear → short → consistent →
correct. Use these adversarial tricks:

- **Pre-mortem**: "next hire reads this in 6 months — where do they get
  stuck?" Name the line.
- **Rubber-duck every public export** in one sentence. If you can't, the
  name or the boundary is wrong (P2).
- **Diff-against-ideal**: for any function > 60 lines, sketch the 15-line
  version. If the gap is mostly ceremony, it's a P2.
- **Delete-test**: for any new abstraction / wrapper / interface, ask "what
  breaks if I delete this and inline the call site?" If the answer is
  "nothing", it's a P2 (dead ceremony).
- **Liar comments**: any comment that disagrees with the code is a P2 (P1
  if it hides a bug).
- **Sibling consistency**: open 1–2 neighboring files in the same dir.
  Does the new code use a different pattern for the same job? P2.
- **God files**: if a touched file crosses 500 lines and the diff adds to
  it, flag for extraction (P2 with a concrete split suggestion).
- **Copy-paste**: any block of > 5 lines duplicated in the diff is a P2
  unless the brainstorm explicitly justified it.
- **Naming**: a function called `processX` that also does Y and Z is a P2.
  A variable named `data` or `temp` in a non-trivial scope is a P3.

### 3.3 Lens 3 — Consistency with repo conventions

Enforce every rule in `AGENTS.md` and `.coderabbit.yaml`. Specifically:

- **Dual AI paths**: Next API routes must use `resolveAiProvider` /
  `defaultGeminiProvider` from `src/server/ai/`. Convex actions must use
  `@google/genai` directly with `GOOGLE_GEMINI_API_KEY`. A new third entry
  style is a P1.
- **SSE dialect**: client-facing streams must use the majority
  `data: {"type":"delta"|"done"|"error",...}` dialect from `src/lib/sse.ts`
  + `src/lib/sseClient.ts`. Named `event:` lines are residual-only (tutor).
  A new dialect is a P1.
- **Prompt registry**: prompts live in the Convex `prompts` table and are
  fetched via `convex/coursePrompts.ts` (`getPrompt`/`renderPrompt`). An
  inline prompt string in product code is a P2 (test fixtures excepted).
- **Shared code**: cross-runtime pure code goes in `shared/`. Code in
  `src/` imported by `convex/` is a P1 (build will fail, but flag anyway).
- **Plan SSOT**: numeric entitlements come from `LIMITS_BY_TIER` in
  `shared/planConfig.ts`. Hard-coded "3 tests" / "5 modules" elsewhere is
  a P2 unless it's a test fixture.
- **ConvexError helpers**: use `throwUnauthorized` and friends from the
  wave-13 helpers. A raw `throw new ConvexError("Unauthorized")` is a P3.
- **Path filters**: `.coderabbit.yaml` filters `audits/**`, `loops/**`,
  `**/_generated/**`, and `**/*.md` out of CodeRabbit review. Don't sneak
  product code into those paths to dodge review (P1 if intentional).
- **Commit style**: AGENTS.md says commit messages should sound "human and
  informal — lowercase, conversational". A conventional-commits style
  message on a touched file is a P3 nitpick.

### 3.4 Lens 4 — Tests & edge cases

- **Coverage of new branches**: every new `if`/`switch`/ternary in product
  code must have at least one test exercising each branch. Missing = P2.
- **Boundary conditions**: empty array, single element, off-by-one,
  `null`/`undefined` where the type allows it, `Date` timezone, very long
  strings, very large arrays. Each untested boundary is a P3 (P2 if the
  branch is on a hot path).
- **Regression risk**: did the diff change a function with existing tests?
  If yes, do the existing tests still cover the new behavior? If they
  still pass but no longer test the interesting case, that's a P2 (silent
  regression).
- **Snapshot drift**: if the diff changes a snapshot, the new snapshot
  must be justified in the fix report. Unjustified snapshot change is a P2.
- **Test isolation**: a new test that depends on order, shared state, or
  real network is a P2.
- **Mock correctness**: a test that mocks the system under test so
  thoroughly that it can only pass is a P2 (tautology test).
- **Missing assertions**: a test that calls the code but doesn't assert
  on the interesting output is a P3.

### 3.5 Lens 5 (optional) — UI / a11y

Only dispatched when the pack touches `_components/**` or
`app/**/page.tsx` / `layout.tsx`.

- **Keyboard**: can every interactive element be reached and activated
  with Tab + Enter/Space? Traps, focus loss, missing focus rings are P2.
- **Screen readers**: meaningful `aria-label` on icon-only buttons;
  `aria-live` on streaming AI output (SSE deltas); `alt` on every
  informative image. Missing = P2.
- **Color contrast**: don't introduce a new text color below WCAG AA. P3.
- **Layout shift**: streaming content must reserve space (skeleton /
  min-height) to avoid CLS. P3.
- **Hydration**: no `Date.now()`, `Math.random()`, `window` reads during
  render. A hydration mismatch is a P2.
- **Controlled vs uncontrolled**: every new input must be controlled or
  explicitly uncontrolled with a `key` reset. Mixed is a P2.

---

## 4. Output format

Each reviewer writes one file: `$RUN_ROOT/audits/pre-pr/{PACK_ID}-lens{N}.md`.

```markdown
# Wave D review — {PACK_ID} — lens {N} ({LENS_NAME})

**Reviewer:** subagent (model: leave blank for orchestrator to fill)
**Reviewed at:** ISO-8601
**Diff range:** develop...HEAD
**Owned files reviewed:** {count}
**Findings:** P0={n} P1={n} P2={n} P3={n}

## Summary
{2–3 sentences. What does the diff do, and is the implementation sound
through this lens? If there are P0/P1, name them here.}

## Walkthrough
{Numbered, file-by-file narrative of the changes — like CodeRabbit's
"Walkthrough" section. Each step: file, what changed, why it matters
through this lens.}

## Findings

### D-{PACK_ID}-L{N}-{nnn}: {title}
- Severity: P0|P1|P2|P3
- Location: {path}:{lineStart}-{lineEnd}
- What is wrong:
- Why it hurts (north-star / CodeRabbit-equivalent concern):
- Suggested fix (1–3 line patch, not a redesign):
```diff
{optional unified diff snippet}
```

## Finishing touches checklist (CodeRabbit-style)
- [ ] Best practices: {note or "n/a"}
- [ ] Performance: {note or "n/a"}
- [ ] Security hotspots: {note or "n/a"}
- [ ] Accessibility: {note or "n/a" for non-UI packs}
- [ ] Testing: {note or "n/a"}

## Clean bill justification (only if zero P0/P1/P2)
{List the 3–5 riskiest lines you examined and why they are OK. An
unjustified clean bill is a failure.}

## Top 3 (for orchestrator)
1. {finding id} — {one line}
2. {finding id} — {one line}
3. {finding id} — {one line}
```

---

## 5. Consolidation rule (orchestrator)

The orchestrator reads all `lens{N}.md` files for `{PACK_ID}` and writes a
single `$RUN_ROOT/audits/pre-pr/{PACK_ID}.md`:

```markdown
# Wave D consolidated review — {PACK_ID}

**Lenses run:** L1, L2, L3, L4{, L5}
**Raw findings:** P0={n} P1={n} P2={n} P3={n}
**Deduplicated findings:** P0={n} P1={n} P2={n} P3={n}
**Verdict:** {send_back_to_wave_C | fix_and_proceed | accept_and_ship}

## Deduplicated finding index
| ID | Severity | Location | Lens(es) | Action |
|----|----------|----------|----------|--------|

## Verdict rationale
{1–2 paragraphs. Why send back, fix-and-proceed, or accept-and-ship.}

## Accepted-with-reason (P2/P3 only)
- {finding id}: accepted because {reason}.
```

Deduplication: same `path:lineRange` + same root cause = one finding, merge
severities (max wins). Different lenses flagging the same line for
different reasons stay separate.

Acceptance gate (LOOP.md §7.5.3):

- Any P0 or P1 remaining → `send_back_to_wave_C`. Wave C must fix and Wave D
  re-runs (only on the touched-again files, see §6).
- P2 remaining → orchestrator fixes inline (cheap) OR accepts with reason
  in the consolidated file AND in `RECORD.md`.
- P3 remaining → accept with reason, or batch-fix if cheap.

---

## 6. Re-review after send-back

If Wave D sent a pack back to Wave C, Wave C fixes only the flagged
findings. Wave D then re-runs **only on the files Wave C touched in this
round**, not on the whole pack. This keeps the re-review cheap and prevents
the "Wave D keeps finding new nits" death spiral.

The orchestrator tracks review rounds in the consolidated file:

```markdown
## Review rounds
| Round | Files reviewed | Findings | Verdict |
|-------|----------------|----------|---------|
| 1     | all owned      | P0=1 P1=2 P2=3 | send_back_to_wave_C |
| 2     | subset (3 files) | P2=1 | accept_and_ship |
```

Hard cap: **3 review rounds.** If round 3 still has P0/P1, the orchestrator
sets `day-status.json` `state=blocked`, `blocked_reason=wave_d_round_3_p1`,
and exits non-zero per LOOP.md §10.5. A human (or the next launcher run)
decides whether to relax the gate.

---

## 7. What Wave D is NOT

- **Not a replacement for CodeRabbit.** CodeRabbit still runs on the PR.
  Wave D just makes sure the PR CodeRabbit sees is already clean enough
  that the iteration loop converges in ≤ 3 rounds.
- **Not a brainstorm.** Wave D does not re-open design. If a reviewer
  thinks the design is wrong, that's a P2 "consider revisiting in next
  wave" finding, not a send-back.
- **Not a verify step.** Wave C verify (`npm run check` + `npm run test`)
  runs before Wave D. Wave D assumes the code builds and tests pass.
- **Not allowed to spawn children.** A Wave D reviewer that tries to spawn
  a sub-subagent is a protocol violation; the orchestrator kills it.
