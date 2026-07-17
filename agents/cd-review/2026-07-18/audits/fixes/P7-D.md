# Fix pack P7-D — Identity-first spaces/tests + log noise

**Findings:** F-W7-003, F-W7-016  
**Status:** done

## Identity-first

Dropped client `userId` args from:

- `spaces.list` / `countForUser` / `get` / `create`
- `tests.createEmptyTest` / `create` / `countForUserThisMonth` / `listAll` / `createWithQuestions`

Identity comes only from Convex auth. Call sites (pages, server actions, API routes, `TestGenerateButton`) updated.

## Logs

Removed noisy `console.log` on knowledge piece create / bulk import limit path.

## Residual

- `default_user` ownership peer still present (F-W7-004) — product decision deferred
- Mixed `ConvexError` vs bare `Error` (F-W7-012) — deferred
