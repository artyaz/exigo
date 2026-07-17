# Fix pack P8-B — Shared env Gemini helpers for learn routes

**Findings:** F-W7-011 (partial toward F-W7-002)  
**Status:** done

## What changed

| File | Change |
|------|--------|
| `src/server/ai/geminiEnv.ts` | `getEnvGeminiClient` / `getEnvGeminiModel` |
| `src/server/ai/index.ts` | re-export |
| `api/learn/{teach,clarify,tutor}` | use shared helpers; drop local copies |

## Explicitly not done

- Full product Next → `resolveAiProvider` / BYOK (F-W7-002 still open)
- 429 retry shared with generate (still generate-only)
