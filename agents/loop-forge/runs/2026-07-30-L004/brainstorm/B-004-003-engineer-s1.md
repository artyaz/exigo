# B-004-003 — engineer / s1

## Meta
- loop_id: loop-004
- subagent_id: B-004-003
- persona: engineer
- seed: s1

## Target domain echoed
An autonomous loop that reviews and improves the visual/interaction layer of the exigo Next.js app, publishing a reviewable HTML surface since the app cannot boot here.

## Recon findings
- `src/styles/exigo-tokens.css` — dark-only opacity ladder + emerald accent; the ONLY place a WCAG number can be *derived* (satisfies AC-02 derivation source). `globals.css` sits beside it.
- Bench fixtures `recon/fixtures/{planted,clean}.html` are **self-contained standalone HTML** and already published→rendered→scored (6/2/0). This proves standalone HTML — not a booted app — is the reviewable unit.
- `next.config.js` has no `output:'export'`; `node_modules` absent + `registry.npmjs.org` firewalled ⇒ `next build`/`next export`/Storybook are **not installable here**. Honest gap.
- `src/app/_components/` is React (`ReactiveExercise.tsx` etc. carry `use client`); JSX cannot render without a toolchain. `cd-review/REVIEW-LENS.md` gives the 4-lens parallel subagent-writes-one-file pattern to adapt.

## Design decisions

### I-004-011: Publish a token-anchored static harness, not the app
- Decision: The loop reviews a **standalone HTML harness** that `<link>`s `src/styles/exigo-tokens.css` and hand-mounts the target surface's markup (copied from the component + declared state). This is exactly the fixture shape the bench already validated end-to-end. No React runtime, no `node_modules`, no dev server (AC-05).
- File(s)/command: harness template beside `recon/fixtures/*.html`; sources `src/styles/exigo-tokens.css`.
- Parent loop: none
- Riskiest assumption: hand-mounted markup faithfully mirrors the React render.
- Warrant: identical fixtures published and scored 6/2/0 in bench-results.

### I-004-012: `mu` derives numbers from tokens, never from pixels
- Decision: Every mechanical numeric claim (contrast, hit-target px) is computed from the CSS variable in `exigo-tokens.css` and the harness's inline rule, cited by variable name; the screenshot only *corroborates*. This is the one honesty seam the bench flagged (#1,#2,#6).
- File(s)/command: `grep` token → contrast math; `BrowserScreenshot` corroborates.
- Parent loop: cd-review
- Riskiest assumption: harness uses the same token, not a hardcoded hex.
- Warrant: AC-02 forbids un-sourced numbers; no `BrowserEvaluate` exists.

### I-004-013: The harness IS the surface-manifest artifact
- Decision: `surface_manifest_written` emits one harness file per route×declared-state from `src/app/` + `_components/`; publishing that file yields the inner `pub.hyperagent.com/p/<token>` URL that becomes `render-bridge-port`. One command, no build step.
- File(s)/command: manifest walker over `src/app/`; `PublishFilePublicly` → inner URL.
- Parent loop: none
- Riskiest assumption: static markup captures interaction states adequately.
- Warrant: matches §4 surface-manifest-port derivation.

### I-004-014: Declare `next export` unavailable-here in the LOOP
- Decision: The loop's capability table states plainly that a real static route export requires `next build && next export` which is **impossible in this environment** (firewalled registry, no deps). It is documented as the future path when deps exist, never silently attempted (AC-04 abstain-honestly).
- File(s)/command: `next.config.js` (needs `output:'export'` + install).
- Parent loop: none
- Riskiest assumption: no offline npm cache exists.
- Warrant: `node_modules` absent and registry firewalled per §3.

### I-004-015: Blast-radius cap = published harnesses, deduped by content hash
- Decision: `MAX_PUBLISHED_ARTIFACTS` counts inner-URL publishes per cycle; a content-hash guard skips re-publishing an unchanged harness so retries don't burn the cap. Treats publish as permanent (AC-08); `UnpublishFile` is not trusted.
- File(s)/command: hash over harness bytes before `PublishFilePublicly`.
- Parent loop: none
- Riskiest assumption: identical bytes ⇒ identical inner render.
- Warrant: §3 says inner URL still serves after unpublish.

## Self-report
- Decisions generated: 5
- Criteria violations caught and corrected: 2 (I-004-012 rewrote a draft numeric verdict to be token-derived per AC-02; I-004-014 replaced a "static export" claim with an honest unavailable-here note per AC-04)
