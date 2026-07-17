# Fix pack P1-C — Shared Open/Embed host + co-located CSS

**Findings:** F-S5-001, F-S5-002 (also minimal F-S5-003 rename)  
**Brain:** S5-B001 — Approach A (shared sandboxed host + inject-once host chrome CSS)

## What changed

### `src/app/_components/exercises/shell/SandboxedFrame.tsx` (new)
- Single postMessage bridge for open + embed: origin `"null"` / same-origin + `contentWindow` source guard (embed’s stricter model).
- Handles `progress` / `complete` / `error` / optional `height` (height only applied when `sizing.mode === "autoHeight"`).
- Chrome: prox bar + done chip with stable class names (`.exg-open*` / `.exg-embed*`).
- Inject-once stylesheet (`#exg-frame-styles`) co-located with the host so lesson / collection / atlas mounts get chrome without playground CSS.
- Pure helpers for tests: `isTrustedFrameMessage`, `decodeFrameMessage`.

### `open/OpenExercise.tsx` / `embed/EmbedExercise.tsx`
- Thin wrappers: build `srcDoc` + sizing policy only.
  - Open: `autoHeight` (120–2000, initial 240).
  - Embed: fixed `EMBED_WINDOW` + `onError`.
- Completion type alias = shared `FrameResult`.

### Open completion rename (F-S5-003 minimal)
- Client completion: `OpenExerciseResult` → `OpenResult` (mirrors embed’s `EmbedResult`).
- Authoring in `open/constructor.ts` keeps `OpenExerciseResult` `{ plan, html, raw }` (mirrors `EmbedExerciseResult`).
- Barrel `open/index.ts` re-exports `OpenResult`.

### `playground/generate/page.tsx`
- Removed orphaned `.exg-open*` / `.exg-embed*` rules; host now injects them.

## Risks

| Risk | Notes |
|------|--------|
| Class name stability | Kept `.exg-open` / `.exg-embed` BEM; no consumer class changes. |
| Height only on open | Fixed embed ignores `height` messages (same as before). |
| Double style tags | Inject-once by id; stripping playground CSS avoids duplicate rules. |
| Import of `OpenExerciseResult` from client barrel | Was completion type; now `OpenResult`. Repo had no external completion imports. |

## Follow-ups (out of pack)

1. Shared `extractFencedHtml` (F-S5-004) — still twin helpers in open/embed constructors.
2. Do not merge open/embed authoring runtimes (toolkit vs CDN stage).
3. Atlas explorer rewrite — not in this pack.

## Tests

- `shell/SandboxedFrame.test.ts` — trust checks + payload decode.
- Existing `open/open.test.ts`, `embed/embed.test.ts` still pass.
- `tsc --noEmit` clean on this change set.
