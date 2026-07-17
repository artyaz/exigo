# Verify — Wave 7

**Branch:** `fix/wave7-product`  
**Date:** 2026-07-18

| Command | Result |
|---------|--------|
| `npm run check` | pass (pre-existing warnings only) |
| `npm run test` | **280** passed (32 files; listAll mismatch case removed with identity-first) |

## Packs

- P7-A SSE re-migrate
- P7-B dead dual delete
- P7-C secret SSOT + fail-fast
- P7-D identity-first spaces/tests + log noise

## Deferred to Wave 8+

- F-W7-002 product Next → resolveAiProvider (L)
- F-W7-004 default_user policy
- F-W7-007/008 tutor route + courseAi further split
- F-W7-009 LessonPhase presentation extract
- F-W7-010 tutor dialect unify
- F-W7-012 ConvexError helpers
- F-W7-013 memory vector search
