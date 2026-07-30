# cycle-scope — 2026-07-30-C001

Launcher-written brief per `agents/brainstorm/LOOP.md` §1.3 + §4.
This file is the single source of the problem brief. The orchestrator copies
§4 (Problem brief) **verbatim** into every Wave α subagent prompt.

## 1. Meta

| Field | Value |
|-------|-------|
| Cycle ID | cycle-001 |
| Cycle type | scout (default — no prior cycle to justify deep) |
| RUN_ROOT | `agents/brainstorm/runs/2026-07-30-C001` |
| Continues from | none (first cycle; archives empty) |
| Harness mode | single-agent (in-process subagents; no CLI peer process available in this environment — recorded per honesty invariant, see RECORD.md) |
| Token target / kill-switch | 350,000 / 380,000 |

## 2. Inherited constraints

**None.** `archive/constraints.jsonl` is empty (0 entries), `archive/novelty.jsonl`
is empty (0 entries), `archive/cycles.json` has `cycles: []`. This is cycle-001 —
the first brainstorm cycle actually run against this loop. There is therefore no
dedup pressure and no `MUST_RESPECT`/`MUST_AVOID`/`MUST_TEST` inheritance.

Consequence for Wave α: the `INHERITED_CONSTRAINTS` block in each subagent brief
reads "none — cycle-001". Consequence for the orchestrator: novelty scoring
(§5.4 step 5) uses `novelty = 1.0` for every idea (no archive to compare
against), so the shortlist is decided by diversity + specificity + actionability.
This is a known cold-start property of cycle-001, not a bug.

## 3. Seed schedule

Cycle 1 mod 5 = **1 → oblique-strategy injection** (§5.1). Each persona's `s2`
run receives one card from Brian Eno & Peter Schmidt's *Oblique Strategies*
deck. Card assignments are in `persona-seed-matrix.md`.

## 4. Problem brief (copied verbatim into every Wave α subagent)

### 4.1 Problem statement

How should Exigo structure an autonomous **UX design/review loop** — a loop that
owns the visual and interaction layer of the product the way `agents/cd-review/`
owns code quality and `agents/brainstorm/` owns ideas?

### 4.2 Context

Exigo has five loops today: `cd-review` (critical — code readability, clarity,
brevity, consistency, correctness), `brainstorm` (divergent — new ideas),
`loop-forge` (authoring — writes new loops), `loop-compose` (composition — takes
two loops, emits a third), and `cdreview-brainstorm-join` (joins the critical and
divergent genomes). **No loop owns UX.** Nothing in the repo reviews whether a
screen is usable, whether an interaction is discoverable, whether a state is
legible, or whether the design system is applied consistently.

The stack is Next.js 15 (App Router) + React 19 + Tailwind v4 + framer-motion +
lucide-react, with Clerk auth, Convex + Prisma + tRPC, and vitest for tests.
Product surfaces live under `src/app/`: `playground`, `spaces`,
`knowledge-nodes`, `settings`, `pricing`, `checkout`, `sign-in`, `sign-up`,
`tests`. Shared UI lives in `src/app/_components/`.

Two grounded facts define the difficulty:

1. **The loop has no eyes.** `package.json` contains no Playwright, no
   Puppeteer, no Storybook, no axe-core, no Chromatic, no Percy — zero browser
   automation and zero visual-regression or accessibility tooling. A UX loop
   that assumes it can screenshot a running app is asserting a capability the
   repo does not currently have.
2. **An informal UX loop already exists, untracked.** Sixteen PNGs sit at repo
   root — `arena-v2.png`, `arena-v3.png`, `arena-v4.png`, `plot-v2.png`,
   `presets-migrated.png`, `settings-page.png`, `generate-success.png`, and
   others. The `v2/v3/v4` and `-migrated` suffixes are the fossil record of
   someone iterating on a screen and manually eyeballing the result. That is
   the process this loop would formalize — and it is evidence about what the
   real workflow needs.

### 4.3 The central tension

UX quality is partly perceptual and partly mechanical. The mechanical part
(contrast ratios, focus order, hit-target size, token drift, layout-shift risk,
missing loading/empty/error states, ARIA correctness) is checkable from source
and DOM. The perceptual part (is this *discoverable*? does this *feel* right?
is the information hierarchy correct?) resists mechanical checking and is where
an autonomous loop is most likely to either rubber-stamp or hallucinate.

A design that ignores this tension will fail. Proposals should be explicit about
which half of the problem they address and how they avoid faking the other half.

### 4.4 Out of scope

- **Do not propose a second LLM provider.** Exigo is a single-model shop;
  anti-sycophancy must be structural (persona / rubric / temperature), not
  model-diversity.
- **Do not propose a human reviewer, approver, or design sign-off step inside
  the worker.** HITL lives only in the launcher, between cycles. A design whose
  quality gate is "a designer looks at it" is out of scope by construction.
- **Do not author the target `LOOP.md` in this cycle.** This cycle produces
  ideas, verdicts, and constraints — the structure outline. Authoring the
  canonical protocol file is `loop-forge`'s δ wave, a later step.
- **Do not propose mutating a parent loop** (`cd-review`, `brainstorm`) to make
  the UX loop work. No-parent-mutation is a canonical invariant
  (loop-forge C-001-can-05).

### 4.5 Success shape

A good output is **3+ design decisions marked `ADVANCE` with external
grounding**, together covering at least:

- **Where UX signal comes from** given the no-eyes constraint (what the loop
  reads, renders, or instruments to obtain reviewable evidence).
- **What the wave structure is** (does the loop mirror brainstorm's α/β/γ, or
  cd-review's audit/brainstorm/fix, or does the design/review duality demand a
  different shape?).
- **How review verdicts stay honest** (what stops the loop from rubber-stamping
  a screen it cannot actually see).

Each decision must name the exigo file or directory it touches, and must carry a
falsifiable riskiest assumption.

## 5. Stop condition (goal-anchored, §8.5.1)

**Goal-anchored:** this cycle closes when all five shortlisted design decisions
carry a 3-state verdict, citations are verified, and `S-002-constraints.md`
exists. The *outer* loop's stop condition for this session is
**"outline the structure of the UX design/review loop"** — satisfied when ≥3
`ADVANCE` decisions jointly cover the three axes in §4.5. If that holds at the
end of cycle-001, the launcher closes the session rather than triggering
cycle-002.

Backstops: novelty-decay-3-consecutive (§8.5.2) and the 380k per-cycle
kill-switch (§8.4.2).
