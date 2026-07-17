# Fix pack P4-D — Split tests/[testId] god page

**Findings:** S11-B002 (P1 — test detail page ~985-line god component)  
**Brain:** Approach B — extract pure markdown helpers + generation/validation hooks + chat sidebar; page stays arena/header orchestrator

## What changed

### New modules under `src/app/_components/tests/`

| File | Role |
|------|------|
| `markdown.tsx` | Pure `renderInlineMarkdown` / `renderMarkdown` (chat message formatting) |
| `useTestQuestionGeneration.ts` | Background SSE generate loop; returns `{ isGeneratingNext, genError, retry }`; keeps `lastGeneratedForCount` guard |
| `useTestAnswerValidation.ts` | Local answers + evaluate state, validate fetch, auto-advance, end-of-test improvements trigger |
| `TestChatSidebar.tsx` | AI tutor column: messages, input, “feels hard” context menu; toast via optional `onToast` |

### Slim page (`src/app/tests/[testId]/page.tsx`)

- Remains composition root for header, card-stack arena, keyboard nav, arena resize, shared toast UI
- Wires hooks + `TestChatSidebar`; no product behavior changes

## Line counts (before → after)

| Path | Lines |
|------|------:|
| **Before** `src/app/tests/[testId]/page.tsx` | **985** |
| **After** `src/app/tests/[testId]/page.tsx` | **499** |
| `src/app/_components/tests/markdown.tsx` | 82 |
| `src/app/_components/tests/useTestQuestionGeneration.ts` | 136 |
| `src/app/_components/tests/useTestAnswerValidation.ts` | 191 |
| `src/app/_components/tests/TestChatSidebar.tsx` | 323 |
| **Page reduction** | **−486 (−49%)** |

## Explicit non-goals (from brain)

- Did not unify card stack with course learn page
- Did not introduce a global state library
- Did not extract card-stack motion out of the page (left until stable)

## Residual

1. Card arena + keyboard nav still live in the page (~500 lines) — intentional per Approach B.
2. `cardHash` still local to test page (sibling learn page has its own) — out of ownership / cross-slice residual only.
3. A few `eslint-disable-next-line react-hooks/exhaustive-deps` remain where original guards lived (generation deps, answer hydrate, keyboard).

## Risks

| Risk | Mitigation |
|------|------------|
| Generation re-fire on re-render | Same `lastGeneratedForCount` + `retryNonce` semantics in hook |
| Auto-advance stale index | Unchanged scheduledIndex capture pattern in validation hook |
| Toast dual ownership | Page owns presentation; chat + validation both call `onToast` / `showToast` |

## Tests run

```bash
npx tsc --noEmit
# clean (exit 0)
```

## Follow-ups

1. Optional: extract active-card body / option list presentational pieces if arena churn continues.
2. Cross-slice: shared `cardHash` with learn page only if both stacks stabilize.
