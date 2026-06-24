# Authoring Exigo exercises — the recipe book

This guide is written to be embedded in a generator model's prompt. It is
deliberately example-first: **copy a recipe, fill the slots, never invent
structure**. Every rule here is also enforced by `validateSpec` — when
validation fails, the error names the field, the rule, and the fix; apply
it and re-validate (generate → validate → repair).

> **Two surfaces, one model.** The JSON below is the *internal* spec the
> runtime executes. AI **construction** does not write this JSON — it writes
> the **markup** surface (`<exercise>…</exercise>`), which compiles to this
> spec. The markup is its own language: not HTML (no `<div>`/`<strong>`/`<code>`
> — prose tags hold markdown) and not JSON (state is `<state>` attributes or a
> JSON body; a reaction is `<on>` with `<set>` children, never a `do=`
> attribute; `<ok>`/`<no>` nest inside `<goal>`; a `<region>`'s label is its
> inner text). The constructor learns the markup by **adapting one complete
> worked example** (`generate/exemplar.ts`) rather than composing from the
> grammar — weak models copy a known-good shape far more reliably than they
> assemble one. The closed tag/attr/child grammar lives in `markup/manifest.ts`
> and drives the parser, the validator, and the prompt's vocabulary listing.

## The iron rule

An exercise is a **picture that reacts**, never a wall of text. You declare
a *data model* and bind it to one rich visual (the `stage`); the runtime
owns every coordinate, color, scale, and animation. **You never write a
coordinate.** If you are tempted to explain something in prose, encode it
in the model so the stage can show it instead.

## The skeleton (fill these slots, in this order)

```jsonc
{
  "type": "reactive",
  "accent": "azure",              // azure | violet | amber | emerald
  "prompt": "…the task, 1-2 sentences, **goal in bold**…",     // REQUIRED
  "criticalThinking": "…one question past the mechanics…",     // REQUIRED, revealed on solve
  "state": { /* your data model — plain values and [] lists */ },
  "reactions": [ /* fold events into the model (cookbook below) */ ],
  "evaluator": { "ok": "<bool expr>", "msgOk": "…", "msgNo": "…", "proximity": "<0..1 expr>" },
  "evaluatePolicy": { "onEvent": true, "onSubmit": false },
  "code":     { /* optional codeProbe (recipes below) */ },
  "stage":    { /* REQUIRED: exactly one rich visual */ },
  "readouts": [ /* ≤ 2 quiet stateBadge/text layers */ ],
  "player":   { "type": "observationPlayer", "source": "obs", "version": "runId",
                "label": "…", "playback": { "mode": "auto", "fps": 2 } }
}
```

Do **not** write a `display` array — the runtime compiles these fields in a
canonical order. Layout, ordering, and styling are not your concern.

## Step 1 — pick the archetype by the shape of your model

| Your model is…                                   | stage type | examples from any domain |
|--------------------------------------------------|------------|--------------------------|
| things occupying bounded containers (sizes, capacity, overflow) | `arena` | allocator buffer, parking lot, cache, synapse vesicle pool |
| an x→y relationship (growth, waves, comparisons against a target) | `plot` | cost curves, cos(θ), dose-response, marbles→volume |
| things pointing at / containing each other (hierarchy, links, order) | `graph` | call tree, linked list, food web, dependency graph |

A `diagramScene` exists for free-form shapes; prefer the three above — they
do the layout for you.

## Step 2 — golden recipes (copy, then rename)

### arena — bounded regions + sized blocks (+ overflow arrow)

```jsonc
"stage": {
  "type": "arena",
  "label": "std::pmr::monotonic_buffer_resource",
  "regions": [
    { "id": "buf",  "label": "buffer",      "capacity": 128, "unit": "B", "tone": "azure" },
    { "id": "heap", "label": "system heap",                  "unit": "B", "tone": "no" }
  ],
  "blocks": "blocks",                              // expr → [{id, region, size, label?}, …]
  "overflow": { "from": "buf", "to": "heap", "label": "overflow" }
}
```
The arena packs blocks proportionally, draws the capacity gauge, routes the
animated overflow arrow, and tones escaped blocks rose. Omit `capacity` for
an unbounded region. Blocks landing in `overflow.to` mean "violation".

### plot — series + target ghost + cursor

```jsonc
"stage": {
  "type": "plot",
  "label": "cost(n) vs budget",
  "x": { "label": "input n", "min": 0, "max": 8 },
  "y": { "label": "operations", "min": 0 },
  "series": [ { "id": "cost", "points": "samples", "style": "area", "tone": "violet", "label": "your cost" } ],
  "target": { "id": "budget", "points": "budget", "style": "line", "tone": "no", "label": "budget" },
  "cursor": { "x": "8", "y": "peak", "label": "peak", "tone": "no" }
}
```
`points` exprs may yield `[[x, y], …]` or `[{x, y}, …]`. Styles: `scatter`
(default) | `line` | `area` | `bar`. Axes auto-fit when `min`/`max` omitted.
The `target` is the goal/limit drawn as a ghost; the `cursor` is one
highlighted point with a readout.

### graph — nodes + edges, runtime layout

```jsonc
"stage": {
  "type": "graph",
  "label": "call tree",
  "nodes": "nodes",          // expr → [{id, label?, tone?}, …]
  "edges": "edges",          // expr → [{from, to, label?, kind?}, …]
  "layout": "tree",          // tree | layered | stack | row | ring
  "directed": true
}
```
Ranks, positions, pill sizes, and curve routing are computed for you.

## Step 3 — the harness: real code emits typed observations

In `code.source`, locked regions call probe functions; the learner edits an
`editableText` region (or fills `blankHole`s). Probes:

| probe | emits fields | use for |
|---|---|---|
| `enter(name, ...args)` | `name, args, depth` | call frames |
| `exit(name, value)`    | `name, value, depth` | returns |
| `alloc(id, size, region, label?)` | `id, size, region, label` | blocks for an arena |
| `write(id, value)`     | `id, value` | cell mutation |
| `ref(from, to)`        | `from, to` | pointers for a graph |
| `mark(label, value?)`  | `label, value` | generic checkpoint |
| `emit("kind", { any: fields })` | your fields | anything else (e.g. plot points) |

`codeProbe` slots: `language: "javascript"`, `harness: { "id": "js-observation" }`,
`editMode: "holes" | "multiRegionFreeText"`, `runMode: "manualRun"`, `event: "ran"`.
`multiRegionFreeText` requires ≥ 1 `editableText` region; `holes` requires ≥ 1 hole.

## Step 4 — the fold cookbook (reactions, copy exactly)

State always carries `obs: []` and `runId: 0`. On run, reset; per
observation, fold. The expression language has **no object literals and no
lambdas** — build records with `record(...)`:

```jsonc
// reset on every run (always include this)
{ "on": "ran", "do": [
  { "set": "obs",   "to": "event.observations" },
  { "set": "blocks","to": "[]" },
  { "set": "runId", "to": "runId + 1" }
]},

// append a row from an observation (arena block, graph node, plot point)
{ "on": "obs:alloc", "allowSequentialWrite": true, "do": [
  { "set": "blocks", "to": "push(blocks, record(\"id\", event.id, \"size\", event.size, \"region\", event.region, \"label\", event.label))" }
]},

// guard on a field (two reactions instead of an if-statement)
{ "on": "obs:alloc", "when": "event.region == \"heap\"", "allowSequentialWrite": true,
  "do": [ { "set": "heapCount", "to": "heapCount + 1" } ] },

// revise an earlier row (e.g. re-tone a call node when its frame returns)
{ "on": "obs:exit", "allowSequentialWrite": true, "do": [
  { "set": "nodes", "to": "setField(nodes, event.depth - 1, \"tone\", \"ok\")" }
]},

// support scrubbing back (always include this)
{ "on": "play:reset", "allowSequentialWrite": true, "do": [ { "set": "blocks", "to": "[]" } ] }
```

A reaction on `obs:<kind>` may only read fields that kind emits — the
validator lists the available fields when you get one wrong.

## Step 5 — goal + critical thinking

- `evaluator.ok` asserts the **model** (`"heapCount == 0 && bufUsed >= 128"`)
  or the **stream** (`obsCount`, `obsContains`, `obsSeq`) — never source text.
  Prefer goals that admit several correct solutions.
- `proximity` (0..1) powers the warmth meter: `"1 - heapCount / 4"`.
- `criticalThinking` is one question that transfers the idea past this
  instance ("when would never-freeing bite you?"). It is revealed on solve.

## Closed vocabularies (pick from these; anything else is rejected)

- **Expression helpers**: `if(cond, a, b)`, `min max abs floor ceil round
  sign clamp mod len concat upper lower range at setAt push swap sum count
  countWhere countMatch removeLast record setField obsCount obsContains obsSeq
  sortStep gridGet gridSet transpose stepLife countNeighbors2d matmul2`
  (`countWhere(list, key, value)` counts rows where row[key]==value;
  `countMatch(list, a, b)` counts rows where row[a]==row[b] — e.g. scoring a
  classification by `countMatch(items, "placed", "correct")`)
- **Tones**: `azure violet amber emerald ok no muted ghost` (`no` = rose =
  violation only; omit tone to get an automatic cycle)
- **Graph layouts**: `tree layered stack row ring` · **Plot styles**:
  `scatter line area bar` · **Playback**: `instant auto step`
- Slider `min`/`max` accept exprs — bind them to the data
  (`"max": "len(steps) - 1"`), never hardcode a guess.
- Slider `value` MUST be the state key its event updates
  (`value="step"` when the reaction does `set step = event.value`). A constant
  `value` makes the thumb snap back — it can't be dragged.

## DON'T (each one is a validator ERROR)

| If you write… | you get |
|---|---|
| a text/richText `stage` | `spec.stage.type`: stage must be a rich visual |
| 3+ `readouts` | `spec.readouts`: text budget is 2 |
| no `prompt` / no `criticalThinking` | required-field error |
| both `stage` and `display` | use one, not both |
| `x => x` or `function(){}` in an expr | lambdas are rejected |
| `{ id: 1 }` in an expr | no object literals — use `record("id", 1)` |
| `time()` in a binding | time enters via tick payload `event.now` |
| `event.<field>` a kind doesn't emit | error listing the available fields |
| free-text code with nothing editable | `editableText` region required |
| a slider with a constant `value` (e.g. `value="1"`) | bind it to state, or the thumb can't move |

## Checklist (do one step at a time)

1. Pick the archetype from the table (what *shape* is the model?).
2. Declare `state`: the model lists + counters the stage reads.
3. Write the harness code: locked scaffold + probes + one editable region.
4. Fold: `ran` reset → `obs:<kind>` appends/updates → `play:reset` clear.
5. Stage recipe + ≤ 2 readouts + player.
6. `evaluator.ok` over the model; `proximity`; `msgOk`/`msgNo`.
7. `prompt` (goal in bold) + `criticalThinking` (the transfer question).
8. Validate. Repair exactly what each error names. Re-validate.
