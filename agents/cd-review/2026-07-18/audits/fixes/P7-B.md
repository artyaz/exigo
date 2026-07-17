# Fix pack P7-B — Delete dead dual teach/clarify + shadow AI actions

**Findings:** F-W7-005, F-W7-006  
**Status:** done

## What changed

| Removed | Reason |
|---------|--------|
| `courseAi.teachLesson` / `clarifyConcept` | Live path is `/api/learn/teach` + `/api/learn/clarify` SSE |
| `teachLessonAction` / `clarifyConceptAction` | No remaining importers |
| `testMessages.chat` | Live path is `testMessagesActions.chat` |
| `knowledgeNodes.generateImprovements` | Live path is `knowledgeNodesActions.generateImprovements` |

`courseAi.ts` ~1179 → ~939 lines (verify + summarize kept).
