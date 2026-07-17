# Fix Pack P3-D — re-type /tests page; share stack card

**Findings:** S11-B003  
**Brain:** S11-B003 approach A (shared `TestStackCard` + restore types on list page)  
**Status:** done

## Summary

`/tests` disabled all lint and typechecking (`/* eslint-disable */` + `// @ts-nocheck`) and forked the 3D stack card UI from space `TestGrid`. Extracted a shared presentational card, mapped `listAll` rows into typed props, and had both surfaces consume the same stack/hover/spotlight markup.

## Per-finding

| ID | Sev | Status | What changed |
|----|-----|--------|--------------|
| S11-B003 | P1 | **done** | Removed nocheck/eslint-disable; shared stack card; local `hashCode` copies in owned files deleted |

## Approach (brain A)

1. Define `TestStackCard` with a small prop model (id, href, stackDepth, status, typeLabel, title, optional eyebrow/footer).
2. Move stack depth, hover scale, spotlight, status badge, progress bar into that component; own hover state inside the card.
3. Re-type `tests/page.tsx` against `api.tests.listAll` return shape (`spaceName`, `questionCount`, `answeredCount`, `config`, …).
4. Wire `TestGrid` to the same card; keep sort/filter/grouping only in the grid.

## Files touched

| File | Change |
|------|--------|
| `src/app/_components/tests/TestStackCard.tsx` | **new** — shared card + `hashCode` / `getProgressStatus` / `formatTestTypeLabel` |
| `src/app/tests/page.tsx` | drop nocheck/eslint-disable; map `listAll` → `TestStackCard`; keep page chrome/empty/loading |
| `src/app/_components/tests/TestGrid.tsx` | drop local hash + card markup; render `TestStackCard` in groups |
| `audits/fixes/P3-D.md` | this writeup |

## Explicitly not changed

- No sort/filter port into the global `/tests` page
- No redirect/deletion of `/tests` (approach C product call)
- No Prisma/tRPC expansion
- Dead `hashCode` on `src/app/spaces/[spaceId]/page.tsx` left alone (out of pack ownership)

## Residual risks

- Global list still titles cards as `Test #N` (index) rather than `topicTitle` — pre-existing product choice, not a type fork.
- Status labels unified to Done / In Progress / Not Started (grid previously said “New” for the empty state).

## Verification

- `npx tsc --noEmit` — clean
- `npx eslint` on owned files — clean
- No `eslint-disable` / `@ts-nocheck` left on `src/app/tests/page.tsx`
