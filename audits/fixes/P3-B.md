# Fix Pack P3-B — Unify exercise tone palettes

**Findings:** S5-B002 / tone map triplication; F-S5-007 (bonus)  
**Brain:** S5-B002 approach A (Sequence + DiagramScene → `visual.toneRgb` / thin solid helper; shell ACCENTS stay chrome-only)  
**Status:** done

## Summary

`visual.ts` claimed to be the single voice for tones, but Sequence and DiagramScene each shipped their own maps with **different RGB for the same tokens** (e.g. amber `252 211 77` vs `254 240 138` / `#fde047`). Both now resolve through `toneRgb` / new `toneSolid`. Local `TONE` constants deleted. Shell `ACCENTS` left as a documented pastel chrome vocabulary (not series ink). Arena overflow marker ids uniquified (F-S5-007).

## Per-finding

| ID | Sev | Status | What changed |
|----|-----|--------|--------------|
| S5-B002 (F tone maps) | P2 | **done** | Sequence + DiagramScene consume shared palette; `toneSolid` for SVG fill strings |
| F-S5-007 | P1 | **done** | Arena marker `id` is per-instance (`exg-arena-head-${n}`), same pattern as Graph/Plot |

## Palette source of truth

| Consumer | API | Notes |
|----------|-----|-------|
| Arena, Graph, Plot | already `toneRgb` | unchanged |
| Sequence | `toneRgb(tone)` when tone set; bare `"255 255 255"` when untoned | preserves neutral chip ink |
| DiagramScene | `toneSolid(t)` / `rgb(muted / 0.7)` default | no more hex/rgba map |
| Shell rails / celebration | `shell/runtimeUi.tsx` `ACCENTS` | **kept**; comment: chrome pastels ≠ series tones |

`TONE_RGB` values (unchanged):

| token | rgb triple |
|-------|------------|
| amber | `252 211 77` |
| azure | `125 211 252` |
| violet | `196 181 253` |
| emerald / ok | `52 211 153` |
| no | `251 113 133` |
| muted | `148 163 184` |
| ghost | `100 116 139` |

## Files touched

| File | Change |
|------|--------|
| `src/app/_components/exercises/display/visual.ts` | export `toneSolid(tone, i?)` on top of `toneRgb` |
| `src/app/_components/exercises/display/Sequence.tsx` | drop local `TONE`; use `toneRgb` |
| `src/app/_components/exercises/display/DiagramScene.tsx` | drop local `TONE`; use `toneSolid` / muted default |
| `src/app/_components/exercises/display/Arena.tsx` | unique `markId` via `ARENA_MARK_SEQ`; spill head fill via `toneRgb("no")` |
| `src/app/_components/exercises/shell/runtimeUi.tsx` | document ACCENTS as chrome-only (no number rewrite) |
| `audits/fixes/P3-B.md` | this writeup |

## Explicitly not changed

- Product palette redesign / CSS design tokens
- Markup `ACCENTS` / `TONES` allow-lists in `manifest.ts` (name lists only)
- Shell ACCENT channel values (pastel vs series divergence is intentional)
- Graph/Plot (already on `visual.ts`)

## Residual risks

- Sequence chips with `muted`/`ghost`/`amber`/… now use series colors instead of pastel/white maps — slight visual shift, intended consistency.
- DiagramScene untinted shapes are slate muted at 0.7 alpha instead of white translucent.
- Visual snapshot / eyeball diffs on amber/azure/violet across sequence + diagram only.

## Verification

- `rg 'const TONE' src/app/_components/exercises/display` → only `TONE_RGB` in `visual.ts`
- `rg 'arena-head' src/app/_components/exercises` → gone (unique `exg-arena-head-*`)
- `npm run test -- src/app/_components/exercises/display/` → 13 passed
