# Fix pack P5-D — Shared client SSE block parser (S7-B002)

**Findings residual:** S7-B002 — triplicated client SSE readers with inconsistent dialects and silent error handlers  
**Brain:** `audits/brainstorm/S7-B002.md` approach **B** (shared block parser + thin per-route adapters)  
**Status:** done

## Summary

Extracted a shared client-side SSE framer (`src/lib/sseClient.ts`) that yields `\n\n`-delimited blocks and parses `event:` / `data:` fields. Migrated CourseTutor (named-event dialect) and LessonPhase teach + clarify (type-in-JSON dialect) onto it without changing wire payloads. Tutor named events stay intact; adapters remain at the call sites. Unit-tested multi-chunk framing and both dialects.

## What changed

### New: `src/lib/sseClient.ts`

| Export | Role |
|--------|------|
| `parseSseBlock(block)` | Pure parse → `{ event?, data }` or null |
| `parseJsonData<T>(data)` | Safe JSON parse; null on malform |
| `iterateSseBlocks(stream)` | Async generator over raw blocks from `ReadableStream` |
| `iterateParsedSseBlocks(stream)` | Async generator over parsed blocks |

Header documents the two server dialects and points at `src/lib/sse.ts` (server framing). Does **not** import OpenAI server `parseSseStream`.

### Tests: `src/lib/sseClient.test.ts`

- Majority + residual named-event block parse
- Multi-chunk reassembly, incomplete trailing buffer drop
- Comment-only / data-less skip, CRLF strip, `parseJsonData` failure

### Consumers migrated

| Consumer | Dialect | Notes |
|----------|---------|--------|
| `CourseTutor.tsx` | Named events (`delta`, `chat_created`, `tool_call`, `tool_result`, `error`) | Skips data-only frames; **error** now surfaces via `streamingContent` and is kept until next send (was empty handler) |
| `LessonPhase.tsx` `streamClarification` | Type-in-JSON (`delta` / `done` / `error`) | Error teacher message prefers `payload.error` when present |
| `LessonPhase.tsx` `teach` | Type-in-JSON | Same handler logic; framing only |

### Doc touch: `src/lib/sse.ts`

Comment points client readers at `sseClient.ts`; clarifies tutor residual dialect remains intentional.

## Explicitly not changed

- Server SSE payloads / routes (`/api/learn/tutor|teach|clarify`, tests generate) — S8 / protocol unify later
- Dual dialect on the wire (adapters only)
- `src/app/_components/tests/useTestQuestionGeneration.ts` — still has its own buffer loop; outside pack ownership (`tests/**`), same majority dialect and can adopt `iterateParsedSseBlocks` later
- OpenAI server stream parser in `src/server/ai/openai.ts`
- Streaming React setState patterns (caller-specific by design)

## Residual risks

| Risk | Notes |
|------|--------|
| Dual dialect still exists | Documented in `sse.ts` + `sseClient.ts` headers; S8 can unify servers later |
| Tests generate client still duplicated | Low; one remaining fork, same majority dialect |
| Tutor error text not a dedicated toast | Surfaces as streaming bubble until next message — better than silent swallow |

## Verification

- `npm run test -- src/lib/sseClient.test.ts src/lib/sse.test.ts` — 14 passed
- `tsc --noEmit` — clean
- `rg` buffer/getReader SSE loops under `src/app/_components/learn` and learn course routes — gone

## Files touched

| File | Change |
|------|--------|
| `src/lib/sseClient.ts` | **New** shared client framer |
| `src/lib/sseClient.test.ts` | **New** multi-chunk + dialect fixtures |
| `src/lib/sse.ts` | Cross-link comment only |
| `src/app/_components/learn/CourseTutor.tsx` | Named-event adapter on shared reader; surface `error` |
| `src/app/spaces/.../LessonPhase.tsx` | Teach + clarify on shared reader |
| `audits/fixes/P5-D.md` | This writeup |

## Follow-ups (optional, out of pack)

1. Migrate `useTestQuestionGeneration` (and any other majority-dialect clients) onto `iterateParsedSseBlocks`.
2. S8: unify tutor server onto type-in-JSON + drop named-event adapter / `sseNamedEvent`.
