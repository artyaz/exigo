# Review slice map — iteration 1 (2026-07-17)

| ID | Focus | Paths |
|----|-------|-------|
| S1 | Convex auth, plans, subscriptions, usage, schema | `convex/schema.ts`, `convex/auth.ts`, `convex/auth.config.ts`, `convex/authDecorators.ts`, `convex/planLimits.ts`, `convex/planLimits.test.ts`, `convex/plans.ts`, `convex/seedPlans.ts`, `convex/subscriptionService.ts`, `convex/subscriptionServiceInternal.ts`, `convex/subscriptionsInternal.ts`, `convex/usageService.ts`, `convex/limitEnforcement.test.ts`, `convex/http.ts`, `convex/health.ts`, `convex/crons.ts` |
| S2 | Convex courses / learn backend | `convex/courseAi.ts`, `convex/courseLessonMessages.ts`, `convex/courseLessons.ts`, `convex/courseModules.ts`, `convex/courseOrchestrator.ts`, `convex/coursePrompts.ts`, `convex/courses.ts`, `convex/courseTutor.ts`, `convex/seedPrompts.ts`, `convex/debugPlan.ts` |
| S3 | Convex knowledge, tests, spaces, misc domain | `convex/knowledgeNodes.ts`, `convex/knowledgeNodesActions.ts`, `convex/knowledgePieces.ts`, `convex/tests.ts`, `convex/tests.test.ts`, `convex/testUtils.ts`, `convex/questions.ts`, `convex/deepDives.ts`, `convex/testMessages.ts`, `convex/testMessagesActions.ts`, `convex/spaces.ts`, `convex/exerciseComments.ts`, `convex/userSettings.ts` |
| S4 | Exercises runtime + markup + harness | `src/app/_components/exercises/runtime/**`, `src/app/_components/exercises/markup/**`, `src/app/_components/exercises/harness/**` |
| S5 | Exercises display, shell, open, embed, comments | `src/app/_components/exercises/display/**`, `shell/**`, `open/**`, `embed/**`, `comments/**`, `ReactiveExercise.tsx`, `index.ts` |
| S6 | Exercises generate, atlas, lesson | `src/app/_components/exercises/generate/**`, `atlas/**`, `lesson/**`, `AUTHORING.md`, `authoring.doc.test.ts` |
| S7 | Learn UI + spaces pages | `src/app/_components/learn/**`, `src/app/spaces/**` |
| S8 | API routes | `src/app/api/**` |
| S9 | Server AI, payments, actions | `src/server/**`, `src/app/actions/**` |
| S10 | Shared, lib, middleware, app shell, styles, config | `shared/**`, `src/lib/**`, `src/middleware.ts`, `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/error.tsx`, `src/app/global-error.tsx`, `src/app/ConvexClientProvider.tsx`, `src/styles/**`, `src/env.js`, `src/trpc/**`, root configs used by app |
| S11 | Playground, settings, pricing, checkout, tests UI, misc pages | `src/app/playground/**`, `src/app/settings/**`, `src/app/pricing/**`, `src/app/checkout/**`, `src/app/tests/**`, `src/app/knowledge-nodes/**`, `src/app/_components/tests/**`, `src/app/_components/auth-ui.tsx`, `src/app/_components/legal-ui.tsx`, `src/app/_components/post.tsx`, sign-in/up, terms, sso |

Agents write to `audits/slices/{ID}.md`.
