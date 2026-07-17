# Fix pack P5-E — LessonMarkdown heading factory (S7-B007)

**Finding:** F-S7-007  
**Brain:** L2 skipped (single-file obvious extract)  
**Status:** done

## Summary

Collapsed four near-copy heading components (`HeadingOne`…`HeadingFour`) into `createHeadingComponent(tag)` driven by `HEADING_LEVEL_CLASS`. Data-drove `MarkerSvgFilters` via `MARKER_FILTERS` seed array. Focus targets, accent/marker classes, decoration, and appendage slots unchanged.

## What changed

### `src/app/_components/learn/LessonMarkdown.tsx`

| Before | After |
|--------|-------|
| `HeadingOne`–`HeadingFour` (~70 lines, identical structure) | `HEADING_LEVEL_CLASS` + `createHeadingComponent(tag)` (~40 lines) |
| Four hand-copied `<filter>` blocks in `MarkerSvgFilters` | `MARKER_FILTERS` table mapped once |
| `h1`–`h4` wired to named components | `createHeadingComponent("h1"|"h2"|"h3"|"h4")` |

Behavior preserved:
- Level classes: `--hero` / `--section` / `--subsection` / `--minor`
- `lesson-heading` + accent hash + marker variant on inner span
- `data-focus-target` + focus state classes via `useFocusState`
- `decorateChildren` key prefix `${sectionKey}-${tag}`
- `AppendageSlot` after each heading

## Explicitly not changed

- Paragraph / list / blockquote / code components
- Decoration, focus context, block-index rehype plugin
- CSS class names / visual design tokens
- Other learn components

## Residual risks

| Risk | Notes |
|------|--------|
| Dynamic tag via `createElement` | Typed against `MarkdownComponentProps<HeadingTag>`; tsc clean |
| Visual regression | Class strings identical; no CSS edits |

## Verification

- `npx tsc --noEmit` — pass
- Manual / visual: headings h1–h4, focus mode classes, appendage slots, marker ink filters

## Files touched

| File | Change |
|------|--------|
| `src/app/_components/learn/LessonMarkdown.tsx` | Heading factory + data-driven SVG filters |
| `audits/fixes/P5-E.md` | This writeup |
