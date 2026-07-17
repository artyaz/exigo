# Fix Pack P0-C — lock message roles (prompt poisoning)

**Findings:** F-S2-001  
**Brain:** S2-B002 approach A  
**Status:** done

## Summary

Public message mutations no longer accept a client-chosen `role`.  
`courseLessonMessages.send` and `courseTutor.sendMessage` always insert `role: "user"`.  
Teacher/tutor replies from the Next.js learn SSE routes use new role-locked public mutations (`sendTeacher` / `sendTutorMessage`) that hardcode the AI role.  
`system` and free-form roles remain available only on `sendInternal` / `sendMessageInternal` (Convex AI path in `courseAi.ts`).

## Per-finding

| ID | Sev | Status | What changed |
|----|-----|--------|--------------|
| F-S2-001 | P0 | **done** | Dropped client `role` arg on public sends; force `"user"`. AI writers use role-locked endpoints or internal mutations. |

## Grep before / after

| Call site | Before | After |
|-----------|--------|-------|
| `api.courseLessonMessages.send` | client passes `role: user\|teacher\|system` | no `role`; always user |
| teach/clarify teacher save | `send` + `role: "teacher"` | `sendTeacher` (hardcoded teacher) |
| `api.courseTutor.sendMessage` | client passes `role: user\|tutor\|system` | no `role`; always user |
| tutor AI save | `sendMessage` + `role: "tutor"` | `sendTutorMessage` (hardcoded tutor) |
| `courseAi.*` | `sendInternal` with teacher/system/user | **unchanged** |

## Files touched

| File | Change |
|------|--------|
| `convex/courseLessonMessages.ts` | `send` forces user; add `sendTeacher`; shared insert helper |
| `convex/courseTutor.ts` | `sendMessage` forces user; add `sendTutorMessage` |
| `src/app/api/learn/teach/route.ts` | user → `send`; teacher → `sendTeacher` |
| `src/app/api/learn/clarify/route.ts` | user → `send`; teacher → `sendTeacher` |
| `src/app/api/learn/tutor/route.ts` | user → `sendMessage`; tutor → `sendTutorMessage` |

## Explicitly not changed

- `courseAi.ts` internal `sendInternal` teacher/system/user writes (already correct)
- Schema / role union on stored documents
- Frontend optimistic UI roles (local only, not DB writes)
- Full consolidation of streaming AI into Convex actions (larger follow-up)

## Residual risks

- Authenticated course owners can still call `sendTeacher` / `sendTutorMessage` with arbitrary content (role is fixed, content is not model-bound). Full closure requires either deploy-key-only writes or AI generation + persist living only inside Convex actions.
- `system` role is not exposed on any public mutation (good); only `sendInternal`.

## Verification

- `npx convex codegen` — TypeScript on Convex functions passed
- Product call sites for public send with non-user role → none remaining
- Streaming teach/clarify/tutor paths still persist user + AI messages
