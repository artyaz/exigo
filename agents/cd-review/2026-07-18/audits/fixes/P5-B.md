# Fix pack P5-B — Space detail page dead residue + Knowledge extract (S7-B003)

**Finding:** S7-B003 / F-S7-006 (Esc kbd affordance without handler)  
**Brain:** `audits/brainstorm/S7-B003.md` — Approach B  
**Status:** done

## Summary

Deleted the incomplete test-gen extraction carcass from `spaces/[spaceId]/page.tsx`, then extracted Knowledge add/bulk + piece list and the knowledge-node modal into dedicated components. Page is now a thin tab shell (header + tabs + compose). Escape closes the knowledge node modal (F-S7-006).

## Line counts

| File | Before | After |
|------|--------|-------|
| `src/app/spaces/[spaceId]/page.tsx` | ~635 | **214** |
| `src/app/_components/spaces/KnowledgeTab.tsx` | — | **375** (new) |
| `src/app/_components/spaces/KnowledgeNodeModal.tsx` | — | **210** (new) |

Net: page shell −421 lines; knowledge UI lives in named components (same behavior).

## What changed

### Dead residue deleted (verified unreferenced)

From `page.tsx`:

| Symbol / group | Notes |
|----------------|--------|
| `createTestServerAction` import | leftover from pre-`TestGenerateButton` extraction |
| `hashCode`, `getUserFacingErrorMessage` | only used by dead test-gen path |
| State: `testType`, `isGenerating`, `showTypeDropdown`, `showTopicPicker`, `selectedTopicId`, `testGenerateError`, `dropdownRef`, `hoveredTestId`, `testMousePos` | never read by live JSX |
| `selectType`, `selectedTopic`, `TypeIcon` | dead helpers |
| Icons: `Clock`, `ChevronDown`, `ListChecks`, `PenLine`, `Shuffle`, `ArrowDown`, `ArrowUp` | only dead paths |
| Also cleaned: unused `useRouter`/`useRef`/`useEffect`/`useMutation`, knowledge bulk imports, node-type icons, `RESOLUTION_THRESHOLD` | moved with extracts or unused |

### `KnowledgeTab.tsx` (new)

- Owns knowledge mode state (`add` / `bulk`), form fields, `isAdding`, bulk file ref
- Add piece + bulk CSV/delimiter import (unchanged contracts)
- Fire-and-forget title auto-gen via `/api/knowledge/title` + `updateTitle` mutation
- Pieces list → `onViewPiece(id)` callback to parent

### `KnowledgeNodeModal.tsx` (new)

- Queries `api.knowledgeNodes.getActiveForPiece` when `pieceId` + `userId` set
- Node type styling via local `getNodeTypeInfo`
- **F-S7-006:** `window` `keydown` listener closes on `Escape` while open (matches Esc kbd hint in footer)
- Backdrop click + X button still close

### `page.tsx` (thin shell)

- `useSpaceData` kept local (space / pieces / tests / questions)
- Tab bar: Learn / Tests / Knowledge
- Tests tab: `TestGenerateButton` + `TestGrid` (unchanged)
- Knowledge tab: `<KnowledgeTab … />`
- Learn tab: `LearnTab`
- Modal + `CourseTutor` at root

## Explicitly not changed

- Test generation UI (already in `TestGenerateButton` / `TestGrid`)
- Knowledge CSV/delimiter import contracts
- Title auto-gen fire-and-forget fetch
- Routing / URL tab segments
- `isAdding` still single flag for add + bulk (shared loading state)

## Residual risks

| Risk | Notes |
|------|--------|
| Title auto-gen silent failures | Unchanged; still `.catch(() => {})` |
| Unrelated tsc error in `CourseTutor.tsx` | `Cannot find name 'streamError'` at L195 — outside pack ownership (likely concurrent Wave5 work). Owned files typecheck clean. |
| Modal query skipped without `userId` | Same as before |

## Verification

- Dead symbols gone from page + spaces components (grep)
- Escape → `onClose` wired in `KnowledgeNodeModal`
- `npx tsc --noEmit`: no errors under owned paths; one pre-existing/parallel error in `learn/CourseTutor.tsx`

## Files touched

| File | Change |
|------|--------|
| `src/app/spaces/[spaceId]/page.tsx` | Delete dead residue; thin tab shell |
| `src/app/_components/spaces/KnowledgeTab.tsx` | **New** — add/bulk + list |
| `src/app/_components/spaces/KnowledgeNodeModal.tsx` | **New** — modal + Escape |
| `audits/fixes/P5-B.md` | This writeup |

## Follow-ups (optional, out of pack)

1. Fix `CourseTutor.tsx` `streamError` (parallel pack).
2. Optional `useSpaceData` colocation if more space sub-views appear.
