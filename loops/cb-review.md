# Codebase Review Loop (`cb-review`)

Continuous **audit → deepen → fix → re-audit** loop for Exigo. Primary success metric is not “more features” — it is a codebase that is **easier to read, clearer, shorter where possible, and consistent with advanced conventions** already established in the repo.

This document is the single source of truth for orchestration, layering, skill routing, and agent briefs.

---

## 0. North-star criteria

Every layer optimizes for, in order:

1. **Readability** — a competent engineer understands intent without archaeology.
2. **Clarity** — names, control flow, and module boundaries match the domain.
3. **Brevity** — delete dead code, collapse duplication, avoid speculative abstraction.
4. **Consistency** — match advanced patterns already in-repo (see §2).
5. **Correctness** — real bugs, races, auth holes, broken contracts — only when fixing does not worsen 1–4.

Bugs that exist *because* of muddled structure rank higher than clever micro-bugs in otherwise clean code.

**Non-goals**

- New product features
- Drive-by refactors outside assigned ownership
- Rewrites for taste alone without a clear readability win
- Expanding test matrices without a concrete failure mode
- Infinite brainstorm nesting (see §4.6 depth limits)

---

## 1. Layered architecture (core upgrade)

The loop is **not** a flat “spawn reviewers, spawn fixers.” Each working agent sits in a stack and may **summon** specialists.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  L0  ORCHESTRATOR (this agent)                                           │
│  Map slices · dispatch · consolidate · pack · verify · decide            │
└────────────────────────────┬─────────────────────────────────────────────┘
                             │ spawns
     ┌───────────────────────┼───────────────────────┐
     ▼                       ▼                       ▼
┌─────────────┐       ┌─────────────┐         ┌─────────────┐
│ L1 REVIEWER │  …N   │ L1 REVIEWER │         │ L1 FIXER    │  …M
│ (slice)     │       │ (slice)     │         │ (fix pack) │
└──────┬──────┘       └──────┬──────┘         └──────┬──────┘
       │ summons on           │                       │ summons on
       │ bug / inconsistency  │                       │ non-trivial fix
       │ / “could be better”  │                       │ design choice
       ▼                      ▼                       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  L2  BRAINSTORM AGENT  (per issue or small issue cluster)                │
│  Load brainstorm skill + domain skills · research · options · recommend  │
└────────────────────────────┬─────────────────────────────────────────────┘
                             │ may call (optional, bounded)
                             ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  L3  RESEARCH / SKILL DISCOVERY                                          │
│  Web search · open SOTA refs · map issue → skill pack · cite sources     │
└──────────────────────────────────────────────────────────────────────────┘
```

### Layer responsibilities

| Layer | Role | Writes code? | Writes artifacts? |
|-------|------|--------------|-------------------|
| **L0 Orchestrator** | Partition work, enforce north star, merge audits, own verify | No (except loop/audit meta files) | `audits/*`, `loops/*` |
| **L1 Reviewer** | Hostile clarity audit of a slice; emit findings | No | `audits/slices/S*.md` |
| **L1 Fixer** | Apply minimal clarity-first fixes in owned files | Yes (owned files only) | `audits/fixes/P*.md` |
| **L2 Brainstorm** | When L1 finds something that needs judgment: expand options, apply skills, research, return a decision package | No | `audits/brainstorm/{id}.md` |
| **L3 Research** | Inside L2 (or as nested read-only agent): pull SOTA practices / skill playbooks for the issue class | No | Cited inside brainstorm doc |

### When L1 **must** summon L2

Summon a brainstorm agent when the L1 agent finds any of:

1. **Bug** with more than one plausible root cause or fix shape  
2. **Inconsistency** across files (two valid conventions fighting)  
3. **Code that can look or be better** — smell is clear but the *best* simplification is not obvious  
4. **Security / auth / money / AI streaming** touchpoint (always deepen)  
5. **Hot-path structure** (exercise runtime, Convex orchestrator, SSE routes) where a wrong minimal fix creates more mud  

### When L1 may **skip** L2

- Pure typo / dead import / obviously identical copy-paste with a single extraction target  
- Finding is already a one-line delete with zero design space  
- Severity P3 polish with a single obvious rename in one file  

**Bias:** when unsure whether to summon — **summon**. Quality of options matters more than agent count for P0–P2.

### Return path (mandatory)

```
L1 detects issue
  → spawns L2 with Issue Packet (§5.1)
  → L2 loads skills + researches (§5–6)
  → L2 writes audits/brainstorm/{BRAIN_ID}.md
  → L2 returns Decision Package to L1 (§5.3)
  → L1 integrates into finding (or fix plan)
  → L1 continues slice / pack work
```

L1 never invents a large redesign without an L2 package attached (or an explicit “skipped L2 because trivial” note).

---

## 2. Macro phases (still A–F)

```
PHASE A — MAP          L0 partitions slices
PHASE B — REVIEW       L1 reviewers (+ L2/L3 on issues)
PHASE C — CONSOLIDATE  L0 merges findings + brainstorm packages
PHASE D — FIX          L1 fixers (+ L2/L3 on non-trivial choices)
PHASE E — VERIFY       L0 check/test + optional L1 re-review
PHASE F — DECIDE       residual → new iteration or stop
```

Diagram with brainstorm layer:

```
A map
  → B [L1 review ──summon──► L2 brainstorm ──research──► L3]
  → C consolidate (findings + brain packages → fix packs)
  → D [L1 fix ──summon──► L2 if design fork ──► L3]
  → E verify
  → F decide (loop or stop)
```

One full A→F cycle is one **iteration**. Prefer many small iterations over one mega-diff.

---

## 3. Advanced conventions to enforce (Exigo-specific)

| Area | Convention |
|------|------------|
| Stack | T3 App Router + Convex primary DB + Clerk auth + Gemini AI |
| Dual DB | Convex for app data; Prisma only legacy scaffolding — don’t grow Prisma |
| Auth (Convex) | `getAuthedContext` / `withAuth` / plan gates from `authDecorators` |
| Auth (Next API) | Clerk `auth()` → `ConvexHttpClient` via `convexClientAuth` |
| AI routes | Prompts from Convex `prompts` + SSE `delta`/`done`/`error` + PostHog AI events |
| Shared code | Cross-runtime pure logic in `shared/` (Convex cannot import `src/`) |
| Paths | `~/` → `src/`; never hand-edit `convex/_generated/` |
| Tests | Vitest `globals: true`; pure units over brittle integration |
| Style | Surgical diffs; match local style; delete > move > rewrite |

**Smell catalog:** god files, copy-pasted SSE/auth/Gemini boilerplate, inconsistent error shapes, dead T3 scaffolding, `any`/silenced TS, over- and under-abstraction, mixed UI+network+prompt concerns, secret leaks, ungated Convex functions, liar comments, implementation-detail tests.

---

## 4. Phase A–F (detailed)

### 4.1 Phase A — Map (L0)

1. Inventory sources excluding `node_modules`, `.next`, `coverage`, `generated`, `convex/_generated`.  
2. Build slices (~5–40 files, one mental model).  
3. Write `audits/slices.md`.  
4. Flag hotspots for mandatory L2 (auth, AI SSE, exercise runtime, course orchestrator).

Default slices S1–S11: see `audits/slices.md`.

### 4.2 Phase B — Parallel review (L1 + L2/L3)

- Spawn one L1 reviewer per slice (split large slices).  
- Capability: **read-only** for L1 review and L2/L3.  
- Each L1 uses the hostile brief (§7.1) and summons L2 per §1.  
- Empty “looks fine” reports are rejected; re-dispatch with sharper prompt.

### 4.3 Phase C — Consolidate (L0)

1. Read `audits/slices/S*.md` and `audits/brainstorm/*.md`.  
2. Dedupe by root cause; attach brain packages to surviving findings.  
3. Prefer L2’s **recommended** option unless it violates north star or Exigo conventions.  
4. Write `audits/cb-review-YYYYMMDD.md` with fix packs (disjoint file ownership).  
5. Fix packs must include the chosen approach text from brainstorm (so fixers don’t re-litigate).

### 4.4 Phase D — Parallel fix (L1 fixers + L2/L3)

- One L1 fixer per pack; **no overlapping files**.  
- If implementing the chosen approach surfaces a new design fork → summon L2 again (depth limits apply).  
- Surgical, clarity-first, behavior-stable unless bug/security.

### 4.5 Phase E — Verify (L0)

1. `npm run check`  
2. `npm run test` (or targeted)  
3. Optional L1 re-review on high-churn packs  
4. `audits/cb-review-YYYYMMDD-verify.md`

### 4.6 Depth, concurrency, and anti-thrash

| Rule | Limit |
|------|--------|
| Brainstorm depth | L1 → L2 → (optional L3 research inside L2). **No L2 spawning another L2.** |
| Brainstorms per L1 reviewer | Soft cap **8** per slice; cluster related issues into one L2 call |
| Parallel L2 under one L1 | Up to **4** concurrent brainstorms |
| Research calls per L2 | Up to **5** web/doc fetches; stop when recommendation is stable |
| Timebox L2 | Prefer one solid Decision Package over exhaustive literature review |
| Re-summon same issue | Only if fixer discovers the package is wrong/incomplete |

---

## 5. L2 Brainstorm protocol

### 5.1 Issue Packet (L1 → L2)

L1 sends:

```text
BRAIN_ID: {SLICE_ID}-B{nnn}
TRIGGER: bug | inconsistency | clarity | structure | security | perf
NORTH_STAR_HURT: which of read/clear/short/consistent/correct
LOCATION: paths + line ranges
SYMPTOM: what looks wrong
EVIDENCE: quotes / behavior
CONSTRAINTS: owned files, no feature work, Exigo conventions
WHAT_I_TRIED_MENTALLY: L1’s first guess (may be wrong)
QUESTION: what decision do you need to return?
```

### 5.2 L2 process (skill-first, research-backed)

L2 is a **non-interactive** adaptation of structured brainstorming skills (see §6). It does **not** wait for human approval; the parent L1 is the “approver.”

**Checklist (in order):**

1. **Context** — read cited files + AGENTS.md relevant sections; note existing patterns.  
2. **Load base brainstorm skill** — multi-option exploration, YAGNI, isolation/clarity, tradeoff tables (§6.1).  
3. **Classify issue** → select **domain skill pack** (§6.2). Load those principles into reasoning.  
4. **Research (L3)** — web/docs for SOTA only when classification is non-trivial or security/AI/architecture. Cite sources in the brain doc.  
5. **Generate 2–3 approaches** — including a ruthless “delete/simplify” option when possible.  
6. **Score each approach** against north star + Exigo conventions + risk + effort.  
7. **Recommend one** — default to smallest change that maximizes clarity.  
8. **Write** `audits/brainstorm/{BRAIN_ID}.md` and return Decision Package to L1.

### 5.3 Decision Package (L2 → L1)

```markdown
## Decision Package — {BRAIN_ID}

### Recommendation
- Approach name:
- One-paragraph rationale:
- Why not the alternatives:

### Approaches considered
| ID | Name | Pros | Cons | North-star score | Effort |
|----|------|------|------|------------------|--------|
| A | … | | | /5 | S/M/L |
| B | … | | | /5 | S/M/L |
| C | … | | | /5 | S/M/L |

### Minimal implementation sketch
- Files to touch:
- Steps (bullet, surgical):
- What NOT to do:

### Skills applied
- Base: brainstorming (structured multi-option + YAGNI)
- Domain: …

### Research notes
- Sources (urls/titles):
- Key takeaway that changed the recommendation:

### Residual risks
### Suggested finding severity / title (for L1)
```

### 5.4 How L1 integrates the package

- Finding’s **Minimal fix** field becomes the recommended sketch.  
- Link: `Brainstorm: audits/brainstorm/{BRAIN_ID}.md`  
- If L1 disagrees, it must document why (north star conflict) — not silently ignore.  
- Fix packs in Phase C copy the recommendation so Phase D is execution, not redesign.

---

## 6. Skills registry (base + domain)

Skills are **playbooks**. Local files win if present; otherwise L2 applies the **principle summary** below and may fetch fuller skill text from known sources.

### 6.1 Base brainstorm skill (always on for L2)

**Preferred local:**  
`~/.agents/skills/brainstorming/SKILL.md` (or project/plugin equivalent)

**SOTA references (ecosystem):**

- Superpowers-style **plan-before-code / multi-approach brainstorm** modules ([obra/superpowers](https://github.com/obra/superpowers) pattern; structured brainstorm before implementation)  
- Installable skill catalogs: [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills), [sickn33/agentic-awesome-skills](https://github.com/sickn33/agentic-awesome-skills)  
- Research ideation patterns: multi-lens brainstorming (e.g. orchestra-research style ideation skills)

**Agent-adapted rules (drop human gates):**

| Human brainstorm skill | Agent loop adaptation |
|------------------------|------------------------|
| Ask user questions one-by-one | Infer answers from code + AGENTS.md; list assumptions explicitly |
| Get user approval on design | L1 parent is approver; return Decision Package |
| Write long product design doc | Write short `audits/brainstorm/{id}.md` only |
| Propose 2–3 approaches + tradeoffs | **Required** |
| YAGNI ruthlessly | **Required** — prefer delete/simplify |
| Isolation & clear unit boundaries | **Required** for structure findings |
| No implementation during brainstorm | **Required** — L2 never edits product code |

### 6.2 Domain skill packs (route by issue class)

| Issue class | Keywords / signals | Skill pack (principles + known sources) |
|-------------|-------------------|----------------------------------------|
| **Clarity / simplicity** | god function, over-abstract, long file | **Karpathy guidelines**: think before coding, simplicity first, surgical changes, goal-driven execution ([multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills), local `coding-guidelines`) |
| **Architecture / boundaries** | mixed layers, wrong module | **Architecture / improve-codebase-architecture** style: clear units, interfaces, dependency direction; Exigo dual-DB + `shared/` rules |
| **Debugging / bugs** | wrong result, race, flake | **Systematic debugging**: hypothesis → evidence → minimal fix; no shotgun patches |
| **TDD / regression** | pure logic bug | **TDD skill**: failing test first when cheap; Vitest globals |
| **Security / auth** | ungated mutation, IDOR, secrets | **Security audit** principles: authz every path, least privilege, no secret logs; Clerk + Convex decorator patterns |
| **API / SSE / AI routes** | streaming, prompts, retries | **API design + AI route consistency**: single SSE event shape, prompt registry, observability hooks; prompt-engineer hygiene for injection/format |
| **Performance** | N+1, huge client bundle, scan limits | **Optimization**: measure hypothesis, fix hot path only, prefer algorithmic clarity over micro-opts |
| **React / UI structure** | prop drilling, mega-page | **Frontend patterns**: container/presentational split only when it shortens; colocate state |
| **Agentic / LLM app debt** | tool loops, memory, wrappers | **Agent architecture audit** principles if local skill exists; avoid wrapper regression |
| **Code review quality** | PR-sized mud | **Code review** skill: severity, evidence, minimal fix |
| **Docs / naming** | liar comments | Concise naming; delete stale comments |

**Discovery rule for L2:** if the issue class is unclear or high-stakes, run a short web search:

```text
query ideas:
- "agent skill SKILL.md {topic} software engineering"
- "site:github.com SKILL.md {topic} brainstorm OR refactor OR security"
- SOTA practice: "{topic} best practices 2025|2026 {stack: Convex|Next.js|SSE}"
```

Then map 1–2 high-quality hits into the Decision Package “Skills applied / Research notes.” Do not paste entire blogs into the audit — extract **actionable constraints**.

### 6.3 Local skills to prefer when available

| Skill | Typical path / trigger |
|-------|------------------------|
| brainstorming | `~/.agents/skills/brainstorming/SKILL.md` |
| coding-guidelines (Karpathy) | `~/.claude/skills/coding-guidelines/SKILL.md` |
| frontend-patterns | `~/.agents/skills/frontend-patterns/SKILL.md` |
| agent-architecture-audit | `~/.agents/skills/agent-architecture-audit/SKILL.md` |
| agent-introspection-debugging | `~/.agents/skills/agent-introspection-debugging/SKILL.md` |
| review / code-review | bundled or marketplace review skills |
| deep-research | when L2 needs multi-source synthesis |

L2 instructions: **read the local SKILL.md** when the path exists; otherwise use §6.1–6.2 principle tables.

---

## 7. Agent briefs (prompt templates)

### 7.1 L1 Reviewer brief

```text
You are an L1 REVIEWER in the Exigo cb-review loop (see loops/cb-review.md).

ROLE
- Hostile clarity audit of slice {SLICE_ID} only: {PATHS}
- North star: readable, clear, short, consistent, then correct.
- This code is known to contain real flaws. Empty praise is failure.

LAYERING (mandatory)
- When you find a bug, inconsistency, security-sensitive issue, hot-path structure
  problem, or non-obvious “could be better” case, SUMMON an L2 brainstorm subagent
  (spawn_subagent, read-only/general-purpose) using the Issue Packet format in §5.1.
- Wait for the Decision Package; link it from the finding.
- Skip L2 only for trivial one-line issues; note “L2 skipped: trivial”.
- Soft cap 8 brainstorms; cluster related smells into one L2 call.
- You do NOT edit product code. You MAY write audits/slices/{SLICE_ID}.md and
  will receive brainstorm files under audits/brainstorm/.

L2 SPAWN PROMPT CORE
- Tell L2 to follow loops/cb-review.md §5–6.
- Pass full Issue Packet.
- Require 2–3 approaches, YAGNI, skills registry, optional web research, Decision Package file.

ADVERSARIAL TRICKS
- Pre-mortem, rubber-duck exports, diff-against-ideal, sibling consistency,
  delete-test, boundary test, assume auth wrong until proven, liar comments.

OUTPUT → audits/slices/{SLICE_ID}.md
## Files reviewed
## Findings (each with severity, category, location, evidence, north-star harm,
   minimal fix, effort, test plan, Brainstorm: path|skipped)
## Patterns
## Recommended fix order
## Explicit non-issues
## Brainstorms summoned (ids)

QUOTA: max(5, ceil(files/3)) findings or defended clean bill.
Return: severity counts + top 3 + list of BRAIN_IDs.
```

### 7.2 L2 Brainstorm brief

```text
You are an L2 BRAINSTORM agent in Exigo cb-review (loops/cb-review.md §5–6).

INPUT ISSUE PACKET
{PACKET}

HARD RULES
- Do NOT edit product code.
- Do NOT spawn another L2.
- You MAY web_search / open_page for SOTA practices and skill playbooks.
- Read local skills when paths exist (brainstorming, coding-guidelines, etc.).
- Prefer simplicity and surgical change over elegant redesigns.
- Match Exigo conventions (AGENTS.md + loop §3).

PROCESS
1. Read locations + nearby patterns.
2. Apply base brainstorm skill (2–3 options, YAGNI, clear boundaries).
3. Route domain skill pack from §6.2; load principles / SKILL.md.
4. Research if non-trivial or security/AI/architecture.
5. Score options on north star; recommend one.
6. Write audits/brainstorm/{BRAIN_ID}.md as full Decision Package (§5.3).
7. Return the package summary to parent.

SUCCESS = parent can implement without re-thinking design.
```

### 7.3 L1 Fixer brief

```text
You are an L1 FIXER in Exigo cb-review (loops/cb-review.md).

OWNED FILES ONLY: {FILE_LIST}
FINDINGS + CHOSEN APPROACHES: {FROM_MASTER_AUDIT}

NORTH STAR: readable, clear, shorter, consistent. Surgical. No features.

LAYERING
- If the pack already includes an L2 recommendation, EXECUTE it (don’t reopen design).
- If a new design fork appears mid-fix, summon L2 once with Issue Packet; then implement.
- Never L2-nest; never touch files outside ownership.

METHOD
1. Read owned files.
2. Implement minimal fix per finding.
3. Delete dead code your change exposes only.
4. Focused tests only for bug/pure helper extracts.
5. Write audits/fixes/{PACK_ID}.md

Return: per-finding done/deferred + risks.
```

### 7.4 L0 Orchestrator checklist

```
1. mkdir -p audits/slices audits/brainstorm audits/fixes loops
2. Branch / stash hygiene
3. Write slices.md
4. Spawn all L1 reviewers (parallel) with §7.1
5. L1s spawn L2s as needed; collect slice + brainstorm artifacts
6. Consolidate master audit + fix packs (attach brain recommendations)
7. Spawn L1 fixers (disjoint files) with §7.3
8. Verify; optional re-review
9. Decide residual / stop; log iteration in §11
```

---

## 8. Severity rubric

| Sev | Meaning |
|-----|---------|
| **P0** | Security, data loss, auth bypass, likely prod crash |
| **P1** | Clear bug or severe readability/consistency debt on a hot path |
| **P2** | Meaningful clarity/brevity win |
| **P3** | Polish |

L2 may upgrade/downgrade severity; L1 records final.

---

## 9. Artifact layout

```
loops/
  cb-review.md
audits/
  slices.md
  slices/S1.md …
  brainstorm/
    S1-B001.md …          ← L2 Decision Packages
  cb-review-YYYYMMDD.md   ← master audit (links brain ids)
  fixes/P1.md …
  cb-review-YYYYMMDD-verify.md
```

### Master audit extra sections

- **Brainstorm index** — BRAIN_ID → finding → recommendation one-liner  
- **Skill/research coverage** — which domain packs were used this iteration  
- **Fix packs** — each finding lists `approach: B (from S3-B002)`  

---

## 10. Prompt tricks (hit rate)

1. Known-flaw framing for L1  
2. Finding quota floor  
3. North-star ordering  
4. Pre-mortem + delete-test + sibling consistency  
5. **Mandatory L2 on non-trivial issues** (this section’s main upgrade)  
6. **Skill routing table** so brainstorms are not generic  
7. **Research budget** with citations, not vibes  
8. Disjoint fix packs  
9. Fixers execute packages — no redesign drift  
10. Re-review after fix  

---

## 11. Execution log

| Iteration | Date | Notes |
|-----------|------|-------|
| 0 | 2026-07-17 | Initial flat loop drafted |
| 1 | 2026-07-17 | **Layered L0/L1/L2/L3** + skill registry + summon protocol added |
| 1-run | 2026-07-17 | Phase B→F wave 1 complete: 11 reviews, 59 brains, 5 P0 fix packs, tests green |

---

## 12. Kickoff checklist (iteration 1+)

- [x] Loop doc with layers (`loops/cb-review.md`)
- [x] Slice map (`audits/slices.md`) — create/update if missing
- [x] Phase B: L1 reviewers for all slices (with L2 summon rights)
- [x] Brainstorm artifacts under `audits/brainstorm/` (59 packages)
- [x] Master audit consolidated (`audits/cb-review-20260717.md`)
- [x] Phase D wave 1: P0 fix packs A–E
- [x] Verify (`tsc` + `npm run test` — see verify doc)
- [x] Decide residual: stop wave 1 or continue P1 wave 2


---

## 13. Worked example (summon flow)

**L1 (S8 API routes)** finds three SSE handlers with different error event shapes and retry logic.

1. L1 clusters into one Issue Packet `S8-B001` (inconsistency + clarity).  
2. Spawns L2 with packet + paths to the three routes.  
3. L2 loads brainstorm + **API/SSE/AI** pack + Karpathy simplicity; skims sibling `teach/route.ts`.  
4. L2 researches briefly “SSE event protocol best practices” only if pattern not already in AGENTS.md.  
5. Options: (A) extract `sse.ts` helper, (B) copy-paste normalize only, (C) full AI gateway rewrite.  
6. Recommends **A** with minimal helper + migrate three routes; scores C as YAGNI fail.  
7. Writes `audits/brainstorm/S8-B001.md`; returns package.  
8. L1 finding F-S8-004 links package; Phase C puts files in one fix pack; L1 fixer implements A only.
