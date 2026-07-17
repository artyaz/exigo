# Verify — Wave 6 residual

**Date:** 2026-07-18  
**Branch:** `fix/wave6-product`

## Commands

| Command | Result |
|---------|--------|
| `npm run check` | pass (pre-existing warnings only: CodeEditor hooks, unused HarnessKind, unused eslint-disable on tests page) |
| `npm run test` | **281** passed (32 files) |

## Packs covered

- P6-A generation lock TTL
- P6-B useTestQuestionGeneration → sseClient
- P6-C dual AI docs
- P6-D syncPerksFromSsot

## Ship status

Not shipped yet — waiting for PR policy (develop/main) when user asks.
