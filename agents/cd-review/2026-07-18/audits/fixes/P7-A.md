# Fix pack P7-A — Re-migrate teach/clarify SSE onto sseClient

**Findings:** F-W7-001  
**Status:** done

## What changed

- `useLessonTeachStream` and `useLessonClarifications` use `iterateParsedSseBlocks` + `parseJsonData`
- Dropped private `getReader` / `buffer.split("\n\n")` loops reintroduced after P5-A hook extract
- Clarify error path prefers `payload.error` when present

## Files

| File | Change |
|------|--------|
| `src/app/_components/learn/useLessonTeachStream.ts` | shared client framer |
| `src/app/_components/learn/useLessonClarifications.ts` | shared client framer |
