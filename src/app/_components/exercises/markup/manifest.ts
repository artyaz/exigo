/* ═══════════════════════════════════════════════════════════════════
   Exigo markup — the component manifest.

   ONE source of truth for the closed authoring vocabulary. It drives the
   parser (which tags/attrs are legal), the validator (repair-oriented
   errors that list what *was* allowed), and — later — the playground
   autocomplete and any fine-tune's schema. Tags are objects; attributes
   are the slots an author fills; behaviour/motion/coordinates are NOT
   here — they live in the render primitives. An author composes; it never
   implements.

   This first cut covers the `arena` archetype + the exercise wrapper.
   plot/graph extend the same table. ═══════════════════════════════════ */

/** How an attribute's raw string is interpreted when lowered to the IR. */
export type AttrKind =
  | "expr" // DSL expression (gets `and`/`or` → `&&`/`||` normalisation)
  | "string" // literal text
  | "number" // coerced via Number()
  | "ident" // a bare identifier (event name, state key, region id)
  | "tone" // must be one of TONES
  | "accent" // must be one of ACCENTS
  | "enum"; // must be one of `values`

export interface AttrSpec {
  name: string;
  kind: AttrKind;
  required?: boolean;
  /** Allowed literals for kind:"enum". */
  values?: readonly string[];
}

export interface TagSpec {
  /** Allowed attributes (besides boolean `flags`). */
  attrs: AttrSpec[];
  /** Boolean attributes — present ⇒ true (e.g. `seq`). */
  flags?: readonly string[];
  /** Child tag names allowed inside. Omit ⇒ no element children. */
  children?: readonly string[];
  /** How inner text is treated. "code" ⇒ verbatim raw-text element. */
  text?: "prose" | "code" | "none";
  /** Accept attributes beyond `attrs` (e.g. `<state>` fields, `<button>`
      payload entries) — they're author-named, not a closed set. */
  openAttrs?: boolean;
  /** One-line purpose, surfaced in docs + (eventually) autocomplete. */
  describe: string;
}

export const ACCENTS = ["azure", "violet", "amber", "emerald"] as const;
export const TONES = ["azure", "violet", "amber", "emerald", "muted", "ghost", "ok", "no"] as const;

export const MANIFEST: Record<string, TagSpec> = {
  /* ── wrapper ─────────────────────────────────────────────────── */
  exercise: {
    attrs: [{ name: "accent", kind: "accent" }],
    children: ["prompt", "think", "state", "on", "goal", "arena", "plot", "graph", "code", "controls", "readout", "player"],
    describe: "Root of one exercise. Holds one stage visual (arena | plot | graph).",
  },
  prompt: { attrs: [], text: "prose", describe: "The task — 1–2 sentences, **goal in bold**." },
  think: { attrs: [], text: "prose", describe: "A transfer question, revealed on solve." },

  /* ── data model ──────────────────────────────────────────────── */
  state: {
    // state keys are open by design — declared by the author as attributes,
    // or as a JSON object in the body. Both forms are accepted.
    attrs: [],
    openAttrs: true,
    describe: 'Initial model. Either attributes (<state count="0" items="[]"/>) or a JSON body (<state>{"count":0}</state>).',
  },
  on: {
    attrs: [
      { name: "event", kind: "ident", required: true },
      { name: "when", kind: "expr" },
    ],
    flags: ["seq"],
    children: ["set"],
    describe: "A reaction: fold an event into the model. `seq` ⇒ sequential write.",
  },
  set: {
    attrs: [
      { name: "key", kind: "ident", required: true },
      { name: "to", kind: "expr", required: true },
    ],
    describe: "One assignment inside a reaction: state[key] = eval(to).",
  },

  /* ── goal ────────────────────────────────────────────────────── */
  goal: {
    attrs: [
      { name: "when", kind: "expr", required: true },
      { name: "proximity", kind: "expr" },
    ],
    children: ["ok", "no"],
    describe: "Evaluator: solved when `when` holds; `proximity` (0..1) drives the warmth rail.",
  },
  ok: { attrs: [], text: "prose", describe: "Message shown when solved." },
  no: { attrs: [], text: "prose", describe: "Message shown when not yet solved." },

  /* ── arena archetype ─────────────────────────────────────────── */
  arena: {
    attrs: [{ name: "label", kind: "string" }],
    children: ["region", "overflow", "blocks"],
    describe: "Bounded regions + sized blocks. Packs, gauges, and routes overflow itself.",
  },
  region: {
    attrs: [
      { name: "id", kind: "ident", required: true },
      { name: "capacity", kind: "number" },
      { name: "unit", kind: "string" },
      { name: "tone", kind: "tone" },
    ],
    text: "prose", // the region's label
    describe: "One region. Omit capacity ⇒ unbounded. Label is the inner text.",
  },
  overflow: {
    attrs: [
      { name: "from", kind: "ident", required: true },
      { name: "to", kind: "ident", required: true },
      { name: "label", kind: "string" },
    ],
    describe: "When `from` fills, blocks escape to `to` — drawn as an animated arc.",
  },
  blocks: {
    attrs: [{ name: "bind", kind: "expr", required: true }],
    describe: "Binds the arena's block list to a state expression.",
  },

  /* ── companions ──────────────────────────────────────────────── */
  code: {
    attrs: [
      { name: "harness", kind: "ident", required: true },
      // Only "free" is buildable from markup today; fill-in "holes" need
      // <blank>/<choice> support the builder doesn't yet emit. Advertising an
      // unbuildable mode just produces guaranteed failures, so it's omitted.
      { name: "edit", kind: "enum", required: true, values: ["free"] },
      { name: "event", kind: "ident" },
    ],
    children: ["locked", "edit"],
    describe: "A code probe. `edit=free` ⇒ learner edits real code in <edit> regions.",
  },
  locked: { attrs: [{ name: "id", kind: "ident", required: true }], text: "code", describe: "Read-only code (verbatim)." },
  edit: {
    attrs: [
      { name: "id", kind: "ident", required: true },
      { name: "maxChars", kind: "number" },
    ],
    text: "code",
    describe: "An editable region; inner text is its initial value.",
  },
  readout: {
    attrs: [
      { name: "label", kind: "string" },
      { name: "value", kind: "expr", required: true },
      { name: "tone", kind: "tone" },
    ],
    describe: "A quiet text badge riding along with the stage (≤ 2 per exercise).",
  },
  player: {
    attrs: [
      { name: "source", kind: "expr", required: true },
      { name: "version", kind: "expr" },
      { name: "label", kind: "string" },
      { name: "fps", kind: "number" },
      { name: "mode", kind: "enum", values: ["instant", "auto", "step"] },
    ],
    describe: "Replays an observation stream as the run plays back.",
  },

  /* ── direct interaction (the no-code path) ───────────────────────
     Buttons/sliders dispatch events that <on> reactions fold — the same
     machinery code uses, minus the code. This is how most non-programming
     exercises take input: tap to choose/classify/order, drag a slider. */
  controls: {
    attrs: [],
    children: ["button", "slider"],
    describe: "A row of learner inputs. The no-code way to drive an exercise.",
  },
  button: {
    attrs: [
      { name: "event", kind: "ident", required: true },
      { name: "label", kind: "string" },
      { name: "disabledWhen", kind: "expr" },
    ],
    // Any other attribute becomes a payload field (an expression) merged into
    // the dispatched event — e.g. <button event="assign" index="0" type='"hard"'>.
    openAttrs: true,
    text: "prose", // label may also be the inner text
    describe: "A tap target. Extra attributes become event payload (expressions).",
  },
  slider: {
    attrs: [
      { name: "event", kind: "ident", required: true },
      { name: "label", kind: "string" },
      { name: "value", kind: "expr" },
      { name: "min", kind: "expr" },
      { name: "max", kind: "expr" },
      { name: "step", kind: "number" },
      { name: "unit", kind: "string" },
    ],
    describe:
      "A draggable scale; fires its event with { value } as it moves. Bind `value` to the state key its event updates (e.g. value=\"step\" when the reaction does set step=event.value) so the thumb tracks its position — a constant `value` snaps back and can't be dragged.",
  },

  /* ── plot stage ──────────────────────────────────────────────── */
  plot: {
    attrs: [{ name: "label", kind: "string" }],
    children: ["x", "y", "series", "target", "cursor"],
    describe: "An x→y chart. Auto-fits axes, picks ticks, draws curves itself.",
  },
  x: {
    attrs: [{ name: "label", kind: "string" }, { name: "min", kind: "number" }, { name: "max", kind: "number" }, { name: "unit", kind: "string" }],
    describe: "The x axis (omit min/max to auto-fit).",
  },
  y: {
    attrs: [{ name: "label", kind: "string" }, { name: "min", kind: "number" }, { name: "max", kind: "number" }, { name: "unit", kind: "string" }],
    describe: "The y axis (omit min/max to auto-fit).",
  },
  series: {
    attrs: [
      { name: "id", kind: "ident", required: true },
      { name: "points", kind: "expr", required: true },
      { name: "style", kind: "enum", values: ["scatter", "line", "area", "bar"] },
      { name: "tone", kind: "tone" },
      { name: "label", kind: "string" },
    ],
    describe: "One drawn series. `points` → [[x,y],…] or [{x,y},…].",
  },
  target: {
    attrs: [
      { name: "id", kind: "ident", required: true },
      { name: "points", kind: "expr", required: true },
      { name: "style", kind: "enum", values: ["scatter", "line", "area", "bar"] },
      { name: "tone", kind: "tone" },
      { name: "label", kind: "string" },
    ],
    describe: "The goal/limit series, drawn as a ghost.",
  },
  cursor: {
    attrs: [
      { name: "x", kind: "expr", required: true },
      { name: "y", kind: "expr", required: true },
      { name: "label", kind: "string" },
      { name: "tone", kind: "tone" },
    ],
    describe: "One highlighted point with a readout.",
  },

  /* ── graph stage ─────────────────────────────────────────────── */
  graph: {
    attrs: [
      { name: "label", kind: "string" },
      { name: "layout", kind: "enum", values: ["tree", "layered", "stack", "row", "ring"] },
    ],
    flags: ["directed"],
    children: ["nodes", "edges"],
    describe: "Nodes + edges; the runtime ranks and routes the layout itself.",
  },
  nodes: {
    attrs: [{ name: "bind", kind: "expr", required: true }],
    describe: "Binds nodes to a state expr → [{id, label?, tone?, group?}, …].",
  },
  edges: {
    attrs: [{ name: "bind", kind: "expr", required: true }],
    describe: "Binds edges to a state expr → [{from, to, label?, kind?}, …].",
  },
};
