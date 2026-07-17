/* ═══════════════════════════════════════════════════════════════════
   Exigo markup → ReactiveSpec.

   A small, raw-text-aware tag parser (HTML *syntax*, closed scene-graph
   *semantics*). It does NOT use a generic XML parser: `<locked>`/`<edit>`
   hold real JS full of `<`, `>`, `&&`, `"` — so the manifest marks those
   as raw-text elements and we scan their bodies verbatim, exactly the way
   HTML treats <script>. The MANIFEST is the authority on what's legal;
   builders lower the validated tree onto the existing IR. The runtime,
   validator, and renderer are untouched — this is purely a frontend.
   ═══════════════════════════════════════════════════════════════════ */
import type {
  ReactiveSpec,
  Reaction,
  Assignment,
  Evaluator,
  Value,
  DisplayLayer,
  ArenaRegion,
  CodeRegion,
  ControlSpec,
  PlotSeries,
  PlotAxis,
  GraphLayout,
  ToneToken,
} from "../runtime/types";
import { MANIFEST, ACCENTS, TONES, type AttrSpec } from "./manifest";

export interface MarkupError {
  line: number;
  message: string;
}
export interface ParseResult {
  spec?: ReactiveSpec;
  errors: MarkupError[];
}

interface Node {
  tag: string;
  attrs: Record<string, string>;
  flags: Set<string>;
  children: Node[];
  text: string;
  line: number;
}

/* ── tokenizer / tree ────────────────────────────────────────────── */

class Cursor {
  pos = 0;
  line = 1;
  constructor(readonly s: string) {}
  eof(): boolean {
    return this.pos >= this.s.length;
  }
  peek(n = 0): string {
    return this.s[this.pos + n] ?? "";
  }
  next(): string {
    const c = this.s[this.pos++] ?? "";
    if (c === "\n") this.line++;
    return c;
  }
  /** Consume `n` characters (keeping line tracking correct). */
  skip(n: number): void {
    for (let i = 0; i < n; i++) this.next();
  }
  starts(t: string): boolean {
    return this.s.startsWith(t, this.pos);
  }
}

class ParseFail extends Error {
  constructor(
    readonly line: number,
    message: string,
  ) {
    super(message);
  }
}

const NAME_RE = /[A-Za-z][A-Za-z0-9:_-]*/y;

/** Decode the standard XML entities in an attribute value. Models routinely
    emit `&quot;`/`&amp;` inside expressions; without this the DSL receives a
    literal `&` and chokes. `&amp;` is decoded last so it can't double-decode. */
function decodeEntities(s: string): string {
  if (!s.includes("&")) return s;
  return s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function skipMisc(c: Cursor): void {
  for (;;) {
    while (!c.eof() && /\s/.test(c.peek())) c.next();
    if (c.starts("<!--")) {
      while (!c.eof() && !c.starts("-->")) c.next();
      for (let i = 0; i < 3 && !c.eof(); i++) c.next(); // consume -->
      continue;
    }
    break;
  }
}

function readName(c: Cursor): string {
  NAME_RE.lastIndex = c.pos;
  const m = NAME_RE.exec(c.s);
  if (!m) throw new ParseFail(c.line, "expected a tag or attribute name");
  if (m.index !== c.pos) throw new ParseFail(c.line, "expected a tag or attribute name");
  c.skip(m[0].length);
  return m[0];
}

/** Parse one element; cursor must sit on `<`. */
function parseElement(c: Cursor): Node {
  const line = c.line;
  if (c.next() !== "<") throw new ParseFail(line, "expected '<'");
  const tag = readName(c);
  const attrs: Record<string, string> = {};
  const flags = new Set<string>();

  let selfClose = false;
  for (;;) {
    while (!c.eof() && /\s/.test(c.peek())) c.next();
    if (c.starts("/>")) {
      c.next();
      c.next();
      selfClose = true;
      break;
    }
    if (c.peek() === ">") {
      c.next();
      break;
    }
    if (c.eof()) throw new ParseFail(line, `unterminated <${tag}>`);
    const an = readName(c);
    while (!c.eof() && /\s/.test(c.peek())) c.next();
    if (c.peek() === "=") {
      c.next();
      while (!c.eof() && /\s/.test(c.peek())) c.next();
      const q = c.next();
      if (q !== '"' && q !== "'") throw new ParseFail(c.line, `attribute "${an}" value must be quoted`);
      let v = "";
      while (!c.eof() && c.peek() !== q) {
        // Tolerate JS-style escapes (\\' \\" \\\\): models reflexively escape
        // quotes the JavaScript way inside attribute values (e.g. "We\\'d").
        if (c.peek() === "\\") {
          c.next();
          const nx = c.peek();
          if (nx === "'" || nx === '"' || nx === "\\") v += c.next();
          else v += "\\";
        } else {
          v += c.next();
        }
      }
      if (c.eof()) throw new ParseFail(line, `unterminated value for "${an}"`);
      c.next(); // closing quote
      attrs[an] = decodeEntities(v);
    } else {
      flags.add(an);
    }
  }

  // An attribute named like a declared boolean flag IS that flag: models
  // routinely write `seq="true"` instead of a bare `seq`. Meet that prior.
  for (const f of MANIFEST[tag]?.flags ?? []) {
    if (f in attrs) {
      if (attrs[f] !== "false") flags.add(f);
      delete attrs[f];
    }
  }

  if (selfClose) return { tag, attrs, flags, children: [], text: "", line };

  // Raw-text element: scan body verbatim to the matching close tag.
  if (MANIFEST[tag]?.text === "code") {
    const close = `</${tag}>`;
    let raw = "";
    while (!c.eof() && !c.starts(close)) raw += c.next();
    if (c.eof()) throw new ParseFail(line, `unterminated <${tag}>`);
    c.skip(close.length);
    return { tag, attrs, flags, children: [], text: dedentCode(raw), line };
  }

  // Normal element: mixed text + child elements until the close tag.
  const children: Node[] = [];
  let text = "";
  for (;;) {
    if (c.eof()) throw new ParseFail(line, `unterminated <${tag}>`);
    if (c.starts(`</${tag}>`)) {
      for (let i = 0; i < tag.length + 3; i++) c.next();
      break;
    }
    if (c.starts("<!--")) {
      skipMisc(c);
      continue;
    }
    if (c.peek() === "<" && c.peek(1) !== "/") {
      children.push(parseElement(c));
      continue;
    }
    if (c.peek() === "<" && c.peek(1) === "/") {
      throw new ParseFail(c.line, `mismatched close tag inside <${tag}>`);
    }
    text += c.next();
  }
  return { tag, attrs, flags, children, text, line };
}

/* ── text normalisation ──────────────────────────────────────────── */

/** Prose: collapse whitespace runs to single spaces, trim. */
function prose(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Code: strip one leading newline, drop close-tag indentation, then
    dedent by the common leading whitespace so the markup can be indented
    while the JS round-trips byte-for-byte. */
function dedentCode(raw: string): string {
  let s = raw.replace(/^\r?\n/, "");
  s = s.replace(/[ \t]*$/, "");
  const lines = s.split("\n");
  let min = Infinity;
  for (const ln of lines) {
    if (ln.trim() === "") continue;
    const indent = /^[ \t]*/.exec(ln)?.[0].length ?? 0;
    if (indent < min) min = indent;
  }
  if (!Number.isFinite(min) || min === 0) return s;
  return lines.map((ln) => (ln.trim() === "" ? ln : ln.slice(min))).join("\n");
}

/** Expression: let authors write `and`/`or` instead of `&&`/`||`. */
function expr(s: string): string {
  return s.replace(/\band\b/g, "&&").replace(/\bor\b/g, "||").trim();
}

/* ── manifest validation ─────────────────────────────────────────── */

function validateNode(n: Node, errs: MarkupError[]): void {
  const spec = MANIFEST[n.tag];
  if (!spec) {
    errs.push({ line: n.line, message: `Unknown tag <${n.tag}>. Allowed: ${Object.keys(MANIFEST).map((t) => `<${t}>`).join(", ")}.` });
    return;
  }
  const allowedAttrs = new Map<string, AttrSpec>(spec.attrs.map((a) => [a.name, a]));
  for (const [name, raw] of Object.entries(n.attrs)) {
    const a = allowedAttrs.get(name);
    if (!a) {
      if (spec.openAttrs) continue; // author-named attrs (state fields, button payload)
      const list = spec.attrs.map((x) => x.name).join(", ") || "(none)";
      errs.push({ line: n.line, message: `<${n.tag}> has no attribute "${name}". Allowed: ${list}.` });
      continue;
    }
    validateAttrValue(n, a, raw, errs);
  }
  for (const a of spec.attrs) {
    if (a.required && !(a.name in n.attrs)) {
      errs.push({ line: n.line, message: `<${n.tag}> is missing required attribute "${a.name}".` });
    }
  }
  for (const f of n.flags) {
    if (!(spec.flags ?? []).includes(f)) {
      errs.push({ line: n.line, message: `<${n.tag}> has no flag "${f}". Allowed flags: ${(spec.flags ?? []).join(", ") || "(none)"}.` });
    }
  }
  for (const child of n.children) {
    if (!(spec.children ?? []).includes(child.tag)) {
      const list = (spec.children ?? []).map((t) => `<${t}>`).join(", ") || "(none)";
      errs.push({ line: child.line, message: `<${child.tag}> is not allowed inside <${n.tag}>. Allowed children: ${list}.` });
    }
    validateNode(child, errs);
  }
}

function validateAttrValue(n: Node, a: AttrSpec, raw: string, errs: MarkupError[]): void {
  if (a.kind === "tone" && !TONES.includes(raw as (typeof TONES)[number])) {
    errs.push({ line: n.line, message: `tone "${raw}" is not a tone. Allowed: ${TONES.join(", ")}.` });
  }
  if (a.kind === "accent" && !ACCENTS.includes(raw as (typeof ACCENTS)[number])) {
    errs.push({ line: n.line, message: `accent "${raw}" is not an accent. Allowed: ${ACCENTS.join(", ")}.` });
  }
  if (a.kind === "enum" && !(a.values ?? []).includes(raw)) {
    errs.push({ line: n.line, message: `${a.name}="${raw}" is invalid. Allowed: ${(a.values ?? []).join(", ")}.` });
  }
  if (a.kind === "number" && Number.isNaN(Number(raw))) {
    errs.push({ line: n.line, message: `${a.name}="${raw}" must be a number.` });
  }
}

/* ── builders: validated tree → IR ───────────────────────────────── */

/** Read a required attribute. Builders run only after manifest validation
    has confirmed every required attr is present, so this never falls back —
    the `?? ""` exists solely to satisfy `noUncheckedIndexedAccess`. */
function req(n: Node, name: string): string {
  return n.attrs[name] ?? "";
}

function coerceStateValue(raw: string): Value {
  const t = raw.trim();
  if (t === "true") return true;
  if (t === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  // A JSON array/object value (common: `<state items='[{…}]'/>`). Without this
  // a non-empty array attribute becomes a STRING — it validates statically but
  // explodes at runtime (at()/len() on a string). Parse it as the data it is.
  if (t.startsWith("[") || t.startsWith("{")) {
    try {
      return JSON.parse(t) as Value;
    } catch {
      return raw;
    }
  }
  return raw;
}

/** Merge a `<state>{…}</state>` JSON object into the state map. The attribute
    form (`<state count="0"/>`) and this form are equally accepted. */
function mergeStateJson(state: Record<string, Value>, text: string): void {
  const t = text.trim();
  if (!t.startsWith("{")) return;
  try {
    const obj = JSON.parse(t) as unknown;
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      for (const [k, v] of Object.entries(obj)) state[k] = v as Value;
    }
  } catch {
    // Not valid JSON — leave state to the attribute form / downstream validator.
  }
}

function buildReaction(n: Node): Reaction {
  const r: Reaction = {
    on: req(n, "event"),
    do: n.children.map((s): Assignment => ({ set: req(s, "key"), to: assignExpr(s.attrs.to) })),
  };
  if (n.attrs.when != null) r.when = expr(n.attrs.when);
  if (n.flags.has("seq")) r.allowSequentialWrite = true;
  return r;
}

/** An assignment value. An empty attribute (`to=""`) is the empty STRING — the
    common reset intent — not an empty (invalid) expression. */
function assignExpr(raw: string | undefined): string {
  const t = (raw ?? "").trim();
  return t === "" ? '""' : expr(t);
}

function buildGoal(n: Node): Evaluator {
  const ev: Evaluator = { ok: expr(req(n, "when")) };
  const okNode = n.children.find((c) => c.tag === "ok");
  const noNode = n.children.find((c) => c.tag === "no");
  if (okNode) ev.msgOk = prose(okNode.text);
  if (noNode) ev.msgNo = prose(noNode.text);
  if (n.attrs.proximity != null) ev.proximity = expr(n.attrs.proximity);
  return ev;
}

function buildArena(n: Node): Extract<DisplayLayer, { type: "arena" }> {
  const regions: ArenaRegion[] = [];
  let blocks = "[]";
  let overflow: Extract<DisplayLayer, { type: "arena" }>["overflow"];
  for (const c of n.children) {
    if (c.tag === "region") {
      const r: ArenaRegion = { id: req(c, "id") };
      const label = prose(c.text);
      if (label) r.label = label;
      if (c.attrs.capacity != null) r.capacity = Number(c.attrs.capacity);
      if (c.attrs.unit != null) r.unit = c.attrs.unit;
      if (c.attrs.tone != null) r.tone = c.attrs.tone as ArenaRegion["tone"];
      regions.push(r);
    } else if (c.tag === "blocks") {
      blocks = expr(req(c, "bind"));
    } else if (c.tag === "overflow") {
      overflow = { from: req(c, "from"), to: req(c, "to") };
      if (c.attrs.label != null) overflow.label = c.attrs.label;
    }
  }
  const arena: Extract<DisplayLayer, { type: "arena" }> = { type: "arena", regions, blocks };
  if (n.attrs.label != null) arena.label = n.attrs.label;
  if (overflow) arena.overflow = overflow;
  return arena;
}

function buildCode(n: Node): Extract<DisplayLayer, { type: "codeProbe" }> {
  const source: CodeRegion[] = n.children.map((c): CodeRegion => {
    if (c.tag === "locked") return { kind: "locked", id: req(c, "id"), text: c.text };
    if (c.tag === "edit")
      return { kind: "editableText", id: req(c, "id"), initial: c.text, maxChars: Number(c.attrs.maxChars ?? 1000) };
    // blank/choice holes are declared in the manifest but not exercised here.
    return { kind: "locked", id: req(c, "id"), text: c.text };
  });
  const code: Extract<DisplayLayer, { type: "codeProbe" }> = {
    type: "codeProbe",
    language: "javascript",
    harness: { id: req(n, "harness") },
    editMode: n.attrs.edit === "free" ? "multiRegionFreeText" : "holes",
    runMode: "manualRun",
    source,
  };
  if (n.attrs.event != null) code.event = n.attrs.event;
  return code;
}

/** A bound that may be a literal number or an expression (slider min/max). */
function numOrExpr(raw: string): number | string {
  return /^-?\d+(\.\d+)?$/.test(raw.trim()) ? Number(raw) : expr(raw);
}

const CONTROL_RESERVED = new Set(["event", "label", "disabledWhen", "value", "min", "max", "step", "unit"]);

function buildControls(n: Node): Extract<DisplayLayer, { type: "controls" }> {
  const controls: ControlSpec[] = n.children.map((c): ControlSpec => {
    const ctl: ControlSpec = { type: c.tag === "slider" ? "slider" : "button", event: req(c, "event") };
    const label = c.tag === "button" ? prose(c.text) || c.attrs.label : c.attrs.label;
    if (label) ctl.label = label;
    if (c.attrs.disabledWhen != null) ctl.disabledWhen = expr(c.attrs.disabledWhen);
    if (c.tag === "slider") {
      if (c.attrs.value != null) ctl.value = expr(c.attrs.value);
      if (c.attrs.min != null) ctl.min = numOrExpr(c.attrs.min);
      if (c.attrs.max != null) ctl.max = numOrExpr(c.attrs.max);
      if (c.attrs.step != null) ctl.step = Number(c.attrs.step);
      if (c.attrs.unit != null) ctl.unit = c.attrs.unit;
    } else {
      // Any non-reserved attribute on a button is a payload field (an expr)
      // merged into the dispatched event — the no-code way to carry context.
      const payload: Record<string, string> = {};
      for (const [k, v] of Object.entries(c.attrs)) if (!CONTROL_RESERVED.has(k)) payload[k] = expr(v);
      if (Object.keys(payload).length) ctl.payload = payload;
    }
    return ctl;
  });
  return { type: "controls", controls };
}

function buildAxis(c: Node): PlotAxis {
  const ax: PlotAxis = {};
  if (c.attrs.label != null) ax.label = c.attrs.label;
  if (c.attrs.min != null) ax.min = Number(c.attrs.min);
  if (c.attrs.max != null) ax.max = Number(c.attrs.max);
  if (c.attrs.unit != null) ax.unit = c.attrs.unit;
  return ax;
}

function buildSeries(c: Node): PlotSeries {
  const s: PlotSeries = { id: req(c, "id"), points: expr(req(c, "points")) };
  if (c.attrs.style != null) s.style = c.attrs.style as PlotSeries["style"];
  if (c.attrs.tone != null) s.tone = c.attrs.tone as ToneToken;
  if (c.attrs.label != null) s.label = c.attrs.label;
  return s;
}

function buildPlot(n: Node): Extract<DisplayLayer, { type: "plot" }> {
  const series: PlotSeries[] = [];
  let target: PlotSeries | undefined;
  let cursor: Extract<DisplayLayer, { type: "plot" }>["cursor"];
  let x: PlotAxis | undefined;
  let y: PlotAxis | undefined;
  for (const c of n.children) {
    if (c.tag === "x") x = buildAxis(c);
    else if (c.tag === "y") y = buildAxis(c);
    else if (c.tag === "series") series.push(buildSeries(c));
    else if (c.tag === "target") target = buildSeries(c);
    else if (c.tag === "cursor") {
      cursor = { x: expr(req(c, "x")), y: expr(req(c, "y")) };
      if (c.attrs.label != null) cursor.label = c.attrs.label;
      if (c.attrs.tone != null) cursor.tone = c.attrs.tone as ToneToken;
    }
  }
  const plot: Extract<DisplayLayer, { type: "plot" }> = { type: "plot", series };
  if (n.attrs.label != null) plot.label = n.attrs.label;
  if (x) plot.x = x;
  if (y) plot.y = y;
  if (target) plot.target = target;
  if (cursor) plot.cursor = cursor;
  return plot;
}

function buildGraph(n: Node): Extract<DisplayLayer, { type: "graph" }> {
  let nodes = "[]";
  let edges: string | undefined;
  for (const c of n.children) {
    if (c.tag === "nodes") nodes = expr(req(c, "bind"));
    else if (c.tag === "edges") edges = expr(req(c, "bind"));
  }
  const g: Extract<DisplayLayer, { type: "graph" }> = { type: "graph", nodes };
  if (n.attrs.label != null) g.label = n.attrs.label;
  if (n.attrs.layout != null) g.layout = n.attrs.layout as GraphLayout;
  if (n.flags.has("directed")) g.directed = true;
  if (edges != null) g.edges = edges;
  return g;
}

function buildPlayer(n: Node): Extract<DisplayLayer, { type: "observationPlayer" }> {
  const mode = (n.attrs.mode ?? "auto") as "instant" | "auto" | "step";
  const fps = n.attrs.fps != null ? Number(n.attrs.fps) : 2;
  const p: Extract<DisplayLayer, { type: "observationPlayer" }> = {
    type: "observationPlayer",
    source: expr(req(n, "source")),
    playback: { mode, fps },
  };
  if (n.attrs.version != null) p.version = expr(n.attrs.version);
  if (n.attrs.label != null) p.label = n.attrs.label;
  return p;
}

function buildExercise(root: Node): ReactiveSpec {
  const spec: ReactiveSpec = {
    type: "reactive",
    state: {},
    evaluatePolicy: { onEvent: true, onSubmit: false },
  };
  if (root.attrs.accent != null) spec.accent = root.attrs.accent as ReactiveSpec["accent"];

  const reactions: Reaction[] = [];
  const readouts: Extract<DisplayLayer, { type: "stateBadge" }>[] = [];

  for (const c of root.children) {
    switch (c.tag) {
      case "prompt":
        spec.prompt = prose(c.text);
        break;
      case "think":
        spec.criticalThinking = prose(c.text);
        break;
      case "state":
        for (const [k, v] of Object.entries(c.attrs)) spec.state[k] = coerceStateValue(v);
        // Models overwhelmingly want to declare state as a JSON object; accept
        // that as readily as the attribute form rather than fight the prior.
        mergeStateJson(spec.state, c.text);
        break;
      case "on":
        reactions.push(buildReaction(c));
        break;
      case "goal":
        spec.evaluator = buildGoal(c);
        break;
      case "arena":
        spec.stage = buildArena(c);
        break;
      case "plot":
        spec.stage = buildPlot(c);
        break;
      case "graph":
        spec.stage = buildGraph(c);
        break;
      case "controls":
        spec.controls = buildControls(c);
        break;
      case "code":
        spec.code = buildCode(c);
        break;
      case "readout": {
        const r: Extract<DisplayLayer, { type: "stateBadge" }> = { type: "stateBadge", value: expr(req(c, "value")) };
        if (c.attrs.label != null) r.label = c.attrs.label;
        if (c.attrs.tone != null) r.tone = c.attrs.tone as Extract<DisplayLayer, { type: "stateBadge" }>["tone"];
        readouts.push(r);
        break;
      }
      case "player":
        spec.player = buildPlayer(c);
        break;
    }
  }
  if (reactions.length) spec.reactions = reactions;
  if (readouts.length) spec.readouts = readouts;
  return spec;
}

/* ── entry point ─────────────────────────────────────────────────── */

export function parseMarkup(src: string): ParseResult {
  const c = new Cursor(src);
  let root: Node;
  try {
    skipMisc(c);
    if (c.eof()) return { errors: [{ line: 1, message: "empty document" }] };
    root = parseElement(c);
  } catch (e) {
    if (e instanceof ParseFail) return { errors: [{ line: e.line, message: e.message }] };
    throw e;
  }
  if (root.tag !== "exercise") {
    return { errors: [{ line: root.line, message: `root must be <exercise>, found <${root.tag}>.` }] };
  }
  const errors: MarkupError[] = [];
  validateNode(root, errors);
  if (errors.length) return { errors };
  return { spec: buildExercise(root), errors: [] };
}
