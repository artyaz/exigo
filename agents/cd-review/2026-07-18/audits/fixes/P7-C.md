# Fix pack P7-C — Server mutation secret SSOT + fail-fast

**Findings:** F-W7-014, F-W7-015  
**Status:** done

## What changed

| File | Change |
|------|--------|
| `convex/serverMutationSecret.ts` | **New** shared `assertServerMutationSecret` |
| `convex/courseLessonMessages.ts` / `courseTutor.ts` | Import shared assert |
| `src/lib/serverMutationSecret.ts` | **New** `requireServerMutationSecret()` for Next |
| `api/learn/{teach,clarify,tutor}` | Fail 503 before AI if secret unset; pass resolved secret |

No more `process.env.EXIGO_SERVER_MUTATION_SECRET ?? ""` at call sites.
