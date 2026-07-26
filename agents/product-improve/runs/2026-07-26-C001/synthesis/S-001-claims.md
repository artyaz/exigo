# S-001 — Cycle cycle-001 Claims Ledger

## Verified claims (from decision packages, all findings code-verified)

### Theme A: AI integration drift
- Claim: courseAi.ts repeats identical 10-line AI-call boilerplate 9 times (~180 LOC). Source: DP-001, I-001-001. Confidence: 0.95
- Claim: Two inline prompts (testMessagesActions.ts, knowledgeNodesActions.ts) violate the Convex prompt registry convention used by 9/10 other AI calls. Source: DP-001, I-001-010/015. Confidence: 0.92
- Claim: Tutor route bypasses resolveAiProvider, breaking BYOK for tutor users. geminiEnv.ts is a self-declared transitional shim with one consumer. Source: DP-001, I-001-029/035. Confidence: 0.90
- Claim: normalizeTopic/normalizeTopicOnly differ by only 14 lines; summarizeLesson has a natural extraction seam at line 829. Source: DP-001, I-001-002/006. Confidence: 0.93

### Theme B: Dead code accumulates
- Claim: tRPC + Prisma scaffold (~400 LOC) has zero production consumers; TRPCReactProvider wraps every page for no purpose. Source: DP-002, I-001-050. Confidence: 0.97
- Claim: 11 of 12 flagged dead-code items confirmed safe to delete (zero imports proven by grep). Only legacy chat shim needs data verification. Source: DP-002. Confidence: 0.95
- Claim: convex/auth.ts, withAuth/withAuthAction, requireProAccess are all unused — artifacts of an earlier design iteration. Source: DP-002, I-001-036/037/040. Confidence: 0.98

### Theme C: Enforcement duplication drifts
- Claim: Plan-limit enforcement is copy-pasted 3-5× across modules with already-diverged error messages (tests.ts line 117 vs 162 vs 320). Source: DP-003, I-001-008/026. Confidence: 0.94
- Claim: Ownership guards (lesson→course→userId) are open-coded 8+ times despite courseAuth.ts existing. courseAuth.ts is ActionCtx-only, blocking reuse in queries/mutations. Source: DP-003, I-001-003. Confidence: 0.91
- Claim: Double plan-limit enforcement (API route + Convex mutation) wastes queries and creates race-condition risk. Source: DP-003, I-001-013. Confidence: 0.88

### Theme D: Auth inconsistency creates security gaps
- Claim: spaces.ts soft-fail queries are NOT load-bearing — clients use `"skip"` guard, query never fires pre-auth. Source: DP-004, I-001-038. Confidence: 0.93
- Claim: /api/knowledge/title has no plan gate — any authed user can invoke unlimited AI generations. Source: DP-004, I-001-020. Confidence: 0.96
- Claim: Middleware does not protect /api/*, relying on handler discipline. A forgotten auth() = public endpoint. Source: DP-004, I-001-042. Confidence: 0.94
- Claim: questions.ts is the gold-standard auth pattern (canReadSpace + throw for writes, soft-fail for reads). Source: DP-004. Confidence: 0.95

### Theme E: Streaming resilience is route-local
- Claim: 429 retry exists in exactly 1/10 AI routes. AGENTS.md promises "up to 3 retries with exponential backoff" — contract violated. Source: DP-005, I-001-031. Confidence: 0.97
- Claim: 6 generate routes produce zero $ai_generation PostHog events — ~40% of AI traffic is invisible. Source: DP-005, I-001-032. Confidence: 0.96
- Claim: Tutor SSE response lacks proxy-buffering headers and structured error logging. Source: DP-005, I-001-030/033. Confidence: 0.94

## Cross-cutting observations

1. **Convention adoption is incomplete, not absent.** Every pattern flagged (prompt registry, spaceAccess, resolveAiProvider, sseResponse, captureAiGenerationEvent) already exists and works. The debt is adoption gaps, not missing design. This means fixes are mechanical, not architectural.

2. **Drift correlates with file age.** Older files (spaces.ts, tests.ts queries, courseTutor.ts) predate the canonical helpers. Newer files (questions.ts, generate routes) adopt them consistently. Migration is a one-time catch-up, not an ongoing battle.

3. **The tutor route is the single biggest consistency outlier.** It bypasses resolveAiProvider, sseResponse, logError, requestId, and correct PostHog shape. One file touches all 5 decision packages.

4. **Dead code is load-bearing for confusion, not function.** tRPC/Prisma scaffold, convex/auth.ts, withAuth wrappers — all create "which path do I use?" onboarding friction without serving any runtime purpose.

5. **DP-003 and DP-004 are complementary.** Write-path quota guards (DP-003) + read-path tenancy (DP-004) should land together for a coherent auth+limits story.
