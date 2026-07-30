# Wave γ — Delta-test specification

**Run:** `2026-07-30-L001-composed-cdreview-brainstorm-join`
**Executed by:** single subagent slot (per `agents/loop-compose/LOOP.md` §γ)
**Harness:** [`delta_test.py`](./delta_test.py) — dependency-free, re-runnable in CI
and inside the sealed canary.

## The property

> Every shipped diff carries **(a)** an ADVANCE-verdict dossier with at least one
> verified citation and **(b)** a before/after measurement on a metric declared
> **before** the fix was written — and a REFUTE verdict blocks the ship even when
> the fix is already written, green, and lens-approved.

## Why this property and not an easier one

The delta-test exists to reject degenerate compositions — the B-003 I-003-DELTA
failure mode, *"loop-forge + brainstorm = brainstorm renamed"*. This pair is
unusually exposed to that failure mode, because **`cd-review` already contains a
brainstorm wave** (Wave B, §6). So "audit findings feed a brainstorm" is not a
new capability; it is cd-review's existing Wave B with a longer name.

The property therefore had to be anchored on something structurally absent from
*both* parents. Measurement is that thing:

- `cd-review` gates on **correctness** (`npm run check`, `npm run test`) and on
  **taste** (Wave D lenses). It never asks *"did this change make the number
  better?"* — there is no metric port, no before-state capture, no delta.
- `brainstorm` gates on **evidence** (Toulmin dossier, 3-state verdict, citation
  TTL cache). It has no repo-write port at all, so there is nothing to measure.

"Optimization" in the request is the word that forces this: an optimization you
did not measure is just a change you liked.

## Method — port-anchored capability probing

The property decomposes into 8 artifact classes. A protocol counts as able to
emit a class only when **both** kinds of evidence exist *in its own spec*:

| Evidence kind | Where it is searched | Why it is required |
|---------------|----------------------|--------------------|
| **PORT** | the protocol's typed `ports:` block only | something must carry the artifact across the loop boundary |
| **WAVE** | the whole protocol body | some wave or gate must actually produce it |

Requiring both is what keeps this from collapsing into keyword-grepping.
Aspirational prose ("we should measure things some day") yields wave-ish text
with no port to carry the artifact, and scores zero. Conversely a port declared
but never produced by any wave also scores zero.

Every hit records file, line number and matched text, so each cell of the
verdict table can be audited by hand. Misses record which of the two evidence
kinds was absent.

### The 8 artifact classes

| Class | Artifact |
|-------|----------|
| `audit_finding` | severity-classified finding with a code:line citation |
| `verified_dossier` | externally-verified dossier carrying a 3-state verdict |
| `verified_citation` | citation verified against a TTL-bounded cache |
| `before_measurement` | metric captured **before** the edit is written |
| `after_measurement` | the same metric re-captured after the edit |
| `measured_delta` | computed delta with an `improved\|neutral\|regressed` call |
| `shipped_diff` | repo-write: a diff / PR actually shipped |
| `refutation_veto` | record of a written, green change **blocked** by a verdict |

### Markdown normalisation

Inside a markdown table a literal `|` must be escaped `\|`. That is formatting,
not semantics, so the probe normalises `\|` → `|` before matching. Without this
a protocol would score differently depending on whether it documented a
vocabulary in a table or in a fenced code block — an artifact of prose layout
deciding a capability verdict.

## Admission rule (canonical)

```
ADMIT IFF  composed emits the full 8-class union
      AND  score(composed) > score(baseline_a)
      AND  score(composed) > score(baseline_b)
      AND  composed adds ≥1 class to baseline_a's gaps     ← degeneracy guard
      AND  composed adds ≥1 class to baseline_b's gaps     ← degeneracy guard
```

The last two conjuncts are the anti-degeneracy teeth. A composition that merely
reproduces one parent's capability set would satisfy "beats the other parent"
while adding nothing — the guard rejects it.

## Two-phase execution

| Phase | `--mode` | Composed capability read from | Question answered |
|-------|----------|-------------------------------|-------------------|
| γ (now) | `contract` | `../composition-contract.md` §"Specification of the composed interface" | *should* this composition be admitted? |
| ε (ship-gate) | `authored` | `agents/cdreview-brainstorm-join/LOOP.md` | did **δ** actually deliver what γ admitted? |

Splitting it this way catches a failure mode a single-phase delta-test cannot
see: **δ authoring something weaker than the contract promised.** The composed
loop has to pass the same bar twice — once as a promise, once as a shipped
artifact.

## Baselines are run on the same input

Both baselines and the composed candidate are probed against *their own real
protocol files* in this repository — `agents/cd-review/LOOP.md` and
`agents/brainstorm/LOOP.md` are read unmodified (`no_parent_mutation`). No
baseline is simulated, paraphrased or reconstructed, which is what makes the
comparison a fair test rather than a story about one.

## Reproduce

```bash
# γ phase
python3 agents/loop-compose/runs/2026-07-30-L001-composed-cdreview-brainstorm-join/gamma/delta_test.py \
        . --mode contract --out /tmp/contract.json

# ε phase (after Wave δ has authored the loop)
python3 agents/loop-compose/runs/2026-07-30-L001-composed-cdreview-brainstorm-join/gamma/delta_test.py \
        . --mode authored --out /tmp/authored.json
```

Exit code is `0` on ADMIT, `1` on REJECT, so the delta-test can gate CI.
