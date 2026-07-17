# Fix pack P6-B — useTestQuestionGeneration on sseClient

**Source:** P5-D residual — tests generate client still had a private buffer loop  
**Priority:** P2  
**Status:** done

## What changed

`src/app/_components/tests/useTestQuestionGeneration.ts` now uses:

- `iterateParsedSseBlocks` for framing
- `parseJsonData` for majority-dialect payloads (`type` in JSON)

Named-event frames are ignored (tests route uses majority dialect only). Rate-limit message heuristics and `lastGeneratedForCount` retry semantics preserved.

## Files

| File | Change |
|------|--------|
| `src/app/_components/tests/useTestQuestionGeneration.ts` | shared client SSE reader |

## Residual

- Tutor named-event dialect still intentional (S8 can unify servers later)
- No new unit test for the hook (behavior matches prior; framing covered by `sseClient.test.ts`)
