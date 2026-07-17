# Fix pack P8-A — LessonPhase presentation extract

**Findings:** F-W7-009  
**Status:** done

## What changed

| File | Role |
|------|------|
| `useFeelsHardMenu.ts` | Context menu + toast + queue/create feels-hard actions |
| `LessonCompletePanel.tsx` | Summarize vs continue CTAs |
| `LessonPhase.tsx` | Wiring only for those concerns |

Line count: **566 → ~483** (still above 350 ideal; section/checkpoint JSX remains).

## Residual

Further extract checkpoint form / section list for sub-350 if needed.
