# Fix pack P6-C — Dual AI stack documentation

**Source:** S8/S9 residual — direct Gemini in Convex actions vs `resolveAiProvider` on Next  
**Priority:** P2  
**Status:** done (docs only — no runtime consolidation)

## Decision

Keep two entry styles. They sit on different runtimes:

- Next (`src/server/ai`) can honor BYOK / custom OpenAI-compatible settings
- Convex actions cannot import `src/server` and stay on env Gemini

Full consolidation would mean either duplicating provider resolution into Convex or pushing all AI through Next — both are large, not a readability win for this residual.

## What changed

| File | Change |
|------|--------|
| `AGENTS.md` | Table of the two paths + shared conventions + “do not grow a third” |

## Residual

- Code still has two Gemini client constructions; intentional boundary, not accidental drift.
- Observability may be richer on Next streaming routes than every Convex action.
