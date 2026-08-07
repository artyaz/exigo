# P-001 — Perceptual register (ux-001)

## Bridge status
**ABSENT.** This environment has no `PublishFilePublicly` / Hyperagent publish
tool and no `BrowserObserve`. Per LOOP.md ports (`render-bridge-port` optional)
and **AC-04**, wave π abstains.

## Published artifacts
- reserved this run: **0**
- used: **0** / cap **3**
- `UnpublishFile`: not called (forbidden on success path; nothing published)

## Bound claims
_None._ No `PERCEPTUAL-PIXELS` findings authored.

## Explicit abstentions
| Surface | Residual claim that needed pixels/a11y-tree | Disposition |
|---------|---------------------------------------------|-------------|
| settings.default | F-002 radio naming/focus; F-005 heading landmark | abstain — no Observe |
| sign-in.default | F-002 loading-name corroboration | abstain |
| sign-up.default | F-002 loading-name corroboration | abstain |
| pricing.default | F-001 loading CTA name in tree | abstain (DOM fix still proposed under δ from source) |
| spaces.default | F-002 mobile button name in tree | abstain (DOM fix still proposed under δ from source) |
| home / terms | (clean mechanically) | no residual |
| playground.default | visual chip size corroboration | abstain — hit-target remains MECHANICAL-CSS from source |
| all admitted | focus-visible / keyboard operability / meaningful sequence | deferred to next run with bridge (BR-001) |

## Rule reminders applied
- Never inferred a render.
- Numbers were not narrated from imaginary screenshots.
- Mechanical findings stay on `mechanical-findings-port`; this register is disjoint.
