# Fix pack P9-A — Tutor route module split

**Findings:** F-W7-007  
**Status:** done

## What changed

| File | Role |
|------|------|
| `tutor/tutorTools.ts` | Embeddings helper, tool declarations, `executeTool` |
| `tutor/assembleTutorContext.ts` | Knowledge nodes + memory cosine + course context |
| `tutor/route.ts` | POST orchestration + stream only (**813 → ~330**) |

## Residual

- Tutor still uses named-event SSE dialect (F-W7-010)
- Memory search still O(n) in request path (F-W7-013)
