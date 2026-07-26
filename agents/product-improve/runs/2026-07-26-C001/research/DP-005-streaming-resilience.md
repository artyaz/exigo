# Decision Package — DP-005

**TRIGGER:** AGENTS.md line 53 promises "Rate limit retries: 429 responses trigger up to 3 retries with exponential backoff on the Next path" — this contract is honoured by exactly ONE route (`tests/generate`) and violated by every other AI call site.

**NORTH_STAR_HURT:** A single Gemini 429 silently kills any non-test AI feature (tutor, teach, clarify, all 6 playground generators). Users see opaque "generation failed" with no retry. Additionally, 6 routes produce zero `$ai_generation` events, making cost/performance analytics blind for ~40% of AI traffic.

**LOCATION:** `src/app/api/generate/{atlas,embed,exercise,lesson,lesson-exercises,open}/route.ts`, `src/app/api/learn/tutor/route.ts`, `src/app/api/tests/generate/route.ts:70-108` (sole retry owner), `src/server/ai/types.ts` (AiProvider interface)

**SYMPTOM:** (1) Rate-limit hits surface as immediate user-visible failures on 9/10 AI routes. (2) Six generate routes are invisible in PostHog AI dashboards. (3) Tutor SSE response lacks proxy-buffering headers, causing nginx/Vercel edge buffering stalls. (4) Tutor errors are unstructured — no requestId, no OTLP log, no `enqueueSseError`. (5) Tutor PostHog events report 0 tokens (synthetic `{ text }` response lacks `usageMetadata`).

**EVIDENCE:**

| Finding | Verified location | Detail |
|---------|------------------|--------|
| I-001-031 | `tests/generate/route.ts:70-108` | `streamWithRetry` — 3 attempts, `(attempt+1)*2000` ms backoff, 429-only. No other route imports or replicates this. |
| I-001-032 | 6 files under `src/app/api/generate/` | None import `captureAiGenerationEvent` or `createAiTraceId`. All call `provider.generate()` or `provider.stream()` with zero observability. |
| I-001-030 | `tutor/route.ts:323-329` | Manual `new Response(stream, { headers })` — missing `X-Accel-Buffering: no` and `no-transform` that `sseResponse()` (sse.ts:47-49) provides. |
| I-001-033 | `tutor/route.ts:316-318` | Bare `send("error", { error: "Tutor request failed" })`. Contrast: teach (line 246-254) uses `logError` + `getErrorAttributes` + `enqueueSseError`; clarify (line 172-180) same. |
| I-001-034 | `tutor/route.ts:207-215, 231-239` | Passes `response: { text: fullResponse }` — `extractTokenAndStatusMetadata` finds no `usageMetadata` → reports 0/0 tokens. Teach passes `lastChunk` (raw vendor object with `usageMetadata`). |

**QUESTION:** Should we extract a shared retry wrapper in `src/server/ai/`, extend the AiProvider interface itself, or continue route-level ad-hoc retry — and how do we close the observability + SSE-consistency gaps in one coherent pass?

---

## Recommendation

### Approaches considered

| ID | Name | Pros | Cons | North-star score | Effort |
|----|------|------|------|-----------------|--------|
| A | **`src/server/ai/retry.ts` wrapper** — a `withRetry(provider)` function returning a decorated `AiProvider` whose `generate()` and `stream()` retry on 429 (3 attempts, exponential backoff). Routes opt-in via `resolveAiProvider` → `withRetry(provider)`. | Single source of truth; testable in isolation; works for both streaming & non-streaming; doesn't change AiProvider contract; aligns with "middleware" philosophy of `src/server/ai/`; existing `streamWithRetry` in tests/generate becomes dead code to delete. | Slightly more indirection; must handle async-iterator retry carefully (can't resume a partially-consumed stream — must restart). | 0.91 | M (~120 LOC new + 6 route touch-points) |
| B | **Extend AiProvider implementations** — bake retry into `GeminiProvider.generate/stream` and `OpenAiProvider.generate/stream` directly. | Zero route changes; invisible to callers. | Violates SRP (provider = transport, not policy); harder to test retry independently; OpenAI-compatible endpoints may not return standard 429; couples retry policy to vendor adapters. | 0.72 | M (changes 2 adapters + tests) |
| C | **Route-level copy-paste** — replicate `streamWithRetry` pattern in each route. | No new abstractions; each route controls its own policy. | 10 routes × retry boilerplate = drift guaranteed; already proven to fail (only 1/10 routes has it); non-streaming routes (`generate()`) need a different shape. | 0.35 | L (high ongoing maintenance) |
| D | **Observability-only patch** — add PostHog calls to 6 routes + fix tutor headers/errors, defer retry. | Smallest diff; ships fast. | Leaves the AGENTS.md contract broken; 429s still silently fail in production. | 0.50 | S |

**Selected: A + observability patch (elements of D bundled in).**

### Minimal implementation sketch

**Files:**

| File | Change |
|------|--------|
| `src/server/ai/retry.ts` (NEW) | `withRetry(provider: AiProvider, opts?: RetryOpts): AiProvider` — wraps `generate` and `stream`; catches `AiProviderError` / any `{ status: 429 }`; 3 attempts; delay = `min(baseMs * 2^attempt, capMs)` + jitter; logs via `logWarn`. |
| `src/server/ai/index.ts` | Re-export `withRetry`. |
| `src/server/ai/resolve.ts` | Optionally apply `withRetry` inside `resolveAiProvider` so ALL routes get retry by default (opt-out via flag). |
| `src/app/api/generate/{atlas,embed,exercise,lesson,lesson-exercises,open}/route.ts` | Add `captureAiGenerationEvent` after AI call completes (non-streaming: wrap result; atlas streaming: capture on final event). |
| `src/app/api/learn/tutor/route.ts` | (1) Replace manual Response with `sseResponse(stream)`. (2) Add `createRequestId`, `logError`, `enqueueSseError` in catch. (3) Pass raw `initialResponse` (has `usageMetadata`) to PostHog instead of `{ text }`. (4) Add `stream: true` + `timeToFirstTokenSeconds` for the streaming branch. |
| `src/app/api/tests/generate/route.ts` | Delete local `streamWithRetry`; use `withRetry(provider)` from `src/server/ai/retry.ts`. |
| `src/server/ai/retry.test.ts` (NEW) | Unit tests: mock provider throwing 429 twice then succeeding; verify 3 attempts, backoff timing, non-429 passthrough. |

**Steps:**

1. Create `src/server/ai/retry.ts` with `withRetry` (handles both `generate` and `stream`).
2. Write `retry.test.ts`; verify green.
3. Wire `withRetry` into `resolveAiProvider` (default-on) — this instantly covers teach, clarify, and all 6 generate routes.
4. Refactor `tests/generate` to consume the shared retry; delete local `streamWithRetry`.
5. Add `captureAiGenerationEvent` to the 6 generate routes (atlas needs a slightly different shape due to NDJSON streaming).
6. Fix tutor: `sseResponse()`, structured error logging, raw response → PostHog.
7. Run `npm run check` + `npm run test` to confirm no regressions.

**What NOT to do:**

- Do NOT change the `AiProvider` interface signature — retry is policy, not transport.
- Do NOT add retry to Convex actions (`convex/courseAi.ts`) — different runtime, different rate-limit profile, Google SDK handles it internally.
- Do NOT attempt to resume a partially-consumed stream on 429 — restart the generation from scratch (the client already handles full-replace via `type: "delta"` accumulation).
- Do NOT add PostHog to atlas at per-node granularity — one `$ai_generation` per atlas run is sufficient (fan-out is internal).
- Do NOT touch the SSE *dialect* (tutor already emits majority `data: {"type":...}` per P11-B) — only fix the Response construction and error path.

### Skills applied

- **Convention enforcement:** AGENTS.md is the contract; unmet promises are bugs.
- **DRY / single-source-of-truth:** 1 retry implementation, not 10.
- **Observability-first:** If it calls a model, it emits `$ai_generation`.
- **Proxy-awareness:** `X-Accel-Buffering: no` + `no-transform` prevent silent buffering behind nginx/Vercel edge.

### Research notes

- The `AiProviderError` class (types.ts:57-65) already carries `.status` — retry can pattern-match on it without vendor-specific parsing.
- `resolveAiProvider` (resolve.ts) is called by every Next AI route — applying retry there is a one-line default that covers all current and future routes.
- Tutor uses `getEnvGeminiClient()` directly (not `resolveAiProvider`) because it needs raw `@google/genai` for function-calling + embeddings. Retry for tutor must wrap the `ai.models.generateContent` / `generateContentStream` calls explicitly, or tutor migrates to `resolveAiProvider` for the text-generation portion.
- Atlas streams NDJSON (not SSE) — it already sets `X-Accel-Buffering: no` manually. Its observability gap is the `$ai_generation` event, not headers.
- The 5 non-streaming generate routes (embed, exercise, lesson, lesson-exercises, open) call `provider.generate()` — retry is straightforward (simple async retry loop).

### Residual risks

| Risk | Mitigation |
|------|-----------|
| Retry amplifies load during a sustained 429 storm | Cap at 3 attempts; exponential backoff + jitter; log each retry for alerting. |
| Tutor's direct `@google/genai` client bypasses `withRetry` | Phase 2: wrap `generateContent`/`generateContentStream` in a thin retry shim inside tutor, or migrate tutor to AiProvider for text gen. |
| Non-streaming routes hold the HTTP connection open during retries (up to ~14 s worst case) | Acceptable for serverless; `maxDuration` already 60-300 s. |
| PostHog event volume increases (~40% more events) | Expected and desired — current blindness is the bigger risk. |

### Suggested finding severity

| Finding | Severity | Rationale |
|---------|----------|-----------|
| I-001-031 (retry gap) | **High** | AGENTS.md contract violation; production 429s cause silent user-facing failures on 9/10 routes. |
| I-001-032 (PostHog blind) | **Medium** | Cost/perf analytics incomplete; no user-facing breakage but impedes operational decisions. |
| I-001-030 (tutor headers) | **Medium** | Can cause intermittent stream stalls behind reverse proxies; not reproducible on Vercel Edge (no nginx), but self-hosted / dev behind nginx affected. |
| I-001-033 (tutor error path) | **Medium** | No structured logging makes production debugging of tutor failures nearly impossible. |
| I-001-034 (tutor 0-token) | **Low** | Analytics-only; tutor token costs under-reported but no functional impact. |
