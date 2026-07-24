# Loop-Compose (`agents/loop-compose/`)

Continuous **enumerate → verdict → delta-test → author → ship** composition loop for Exigo.

This is a **sibling loop extracted mid-task from `agents/loop-forge/`**. Where
loop-forge authors new loops from a target domain statement, **loop-compose
authors a new loop by composing two existing loops** via typed-port
composition contracts.

## Quick links

- **Canonical protocol:** [`LOOP.md`](./LOOP.md) — the single source of truth (read this first)
- **Composition memory:** [`archive/composition-manifest.jsonl`](./archive/) — prior compositions (stare decisis)
- **Per-cycle runs:** [`runs/YYYY-MM-DD-LNNN-composed-<name>/`](./runs/) — immutable dated artifacts
- **Extraction record:** [`agents/loop-forge/_meta-session/runs/2026-07-25-C001/extract/loop-compose.md`](../loop-forge/_meta-session/runs/2026-07-25-C001/extract/)

## How it works (one paragraph)

A launcher session (user-triggered) supplies two existing loop directories
plus a composition contract; loop-compose's composition-scope agent runs
α (enumerate port-bindings) → β (issue COMPOSE/CONFLICT/ORTHOGONAL verdict per
pair) → γ (delta-test: composed must beat BOTH parents on a declared property)
→ δ (author the composed LOOP.md + skeleton) → ε (canary ship-gate: spawn the
composed loop as a leaf worker with a trivial-domain spec, kill mid-step,
verify cold-launcher resume). The composition manifest grows monotonically
as the cross-composition memory — future calls consult prior compositions
for similar loop pairs.

## How to start

```bash
grok -p "$(cat <<'EOF'
You are the loop-compose COMPOSITION-SCOPE ORCHESTRATOR for Exigo.
Read and obey agents/loop-compose/LOOP.md entirely.
RUN_ROOT=agents/loop-compose/runs/2026-07-25-L001-composed-brainstorm-loopforge-pipe
LOOP_A=agents/brainstorm/
LOOP_B=agents/loop-forge/
COMPOSITION_CONTRACT={…yaml…}
HARD_BUDGET_TOKENS=380000
NO HUMAN IN THE LOOP. Do not pause for "should I continue?".
EOF
)" --cwd <repo> --output-format json --yolo
```

## Why this exists

During `agents/loop-forge/` cycle-001 Wave β, subagent R-003 verified that
the composition primitive (typed ports + 3-state verdict + delta-test) is
a non-trivial operation that takes two existing loops and produces a new
one. Per the user's brief ("If agent needs, it must create an even new loop
mid-task that it thinks gonna reach more quality work, and if that loop
really something we could benefit from in future"), the loop-forge
orchestrator filed a `loop-itch.md` and extracted this sibling loop.

This is the **demonstration that loop-forge's mid-task extraction protocol
works** — and a reusable composition primitive for future use.
