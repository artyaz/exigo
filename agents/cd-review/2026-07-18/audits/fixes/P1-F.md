# Fix Pack P1-F — dead sessionStorage for test topic

**Findings:** F-S11-001  
**Brain:** S11-B001 approach A (`test.knowledgePieceId`; drop sessionStorage)  
**Status:** done

## Summary

Client readers used `sessionStorage.getItem(\`exigo_test_topic_${tId}\`)` for generate / validate / feels-hard / high-score improvements, but **nothing in the repo ever wrote that key**. Tests already store `knowledgePieceId` on the Convex document via `createEmptyTest`. Switched all three readers to `test.knowledgePieceId` so piece-guided generation and improvements actually receive the id.

## Per-finding

| ID | Sev | Status | What changed |
|----|-----|--------|--------------|
| F-S11-001 | P1 | **done** | Replaced 3 dead `sessionStorage` reads with `test.knowledgePieceId` / `test?.knowledgePieceId`; dropped unnecessary `as Id<"knowledgePieces">` cast (field already typed) |

## Call sites

| Path | Before | After |
|------|--------|-------|
| Background generate (`/api/tests/generate`) | `sessionStorage.getItem(...)` | `test.knowledgePieceId` (effect already guards `!test`) |
| `handleAnswer` → validate + improvements | `sessionStorage.getItem(...)` | `test?.knowledgePieceId` |
| `handleFeelsHard` | `sessionStorage.getItem(...)` | `test?.knowledgePieceId` |

## Files touched

| File | Change |
|------|--------|
| `src/app/tests/[testId]/page.tsx` | 3 readers → Convex field; no writers added |
| `audits/fixes/P1-F.md` | this writeup |

## Explicitly not changed

- `TestGenerateButton` — already passes `knowledgePieceId` into `createEmptyTest`
- Convex schema / API routes — client body shape unchanged
- No hybrid `sessionStorage ?? test.knowledgePieceId` fallback (brain: dual store rejected)

## Residual risks

- Legacy tests without `knowledgePieceId` still generate from API first/random-piece fallback (pre-existing).
- Improvements still require a piece id; piece-less tests skip the gate as before.

## Verification

- `rg 'exigo_test_topic_|sessionStorage' src/app/tests` → empty
- Manual smoke: create test from a specific piece → open detail → generate body / score≥0.8 improvements use `test.knowledgePieceId` without any sessionStorage seed
