/* ═══════════════════════════════════════════════════════════════════
   EXIGO AAP — Spec validator.
   Catches the non-negotiable errors from §11 before the VM ever runs.
   Operates on an untrusted parsed object (e.g. from the playground), so
   every access is defensive.
   ═══════════════════════════════════════════════════════════════════ */
import { compile, ExprError, type Ast } from "./expr";
import { HELPER_NAMES } from "./helpers";
import { bindingOrder, VMError } from "./vm";
import type { Value } from "./types";
import { HARNESS_EDIT_COMPAT, isObservationHarness, type HarnessKind, type ObservationSchema } from "../harness/types";
import { getHarness, HARNESSES } from "../harness/registry";

export interface ValidationError {
  path: string;
  message: string;
}
export interface ValidationResult {
  ok: boolean;
  errors: ValidationError[];
  warnings: string[];
}

const ALLOWED_DISPLAY = new Set([
  "text",
  "richText",
  "numberLine",
  "stateBadge",
  "cards",
  "tape",
  "sequence",
  "observationPlayer",
  "diagramScene",
  "arena",
  "plot",
  "graph",
  "codeProbe",
  "controls",
]);

const PLAYBACK_MODES = new Set(["instant", "auto", "step"]);

/* §12 graphical hard gate: what may stand on the stage, what counts as a
   quiet readout, and which stage kinds are visually thin enough to warn on. */
const STAGE_KINDS = new Set(["arena", "plot", "graph", "diagramScene", "tape", "sequence", "numberLine"]);
const READOUT_KINDS = new Set(["stateBadge", "text", "richText"]);
const LOW_DENSITY_STAGE = new Set(["numberLine", "sequence", "tape"]);

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

interface ExprCheck {
  knownRefs: Set<string> | null; // null = open (don't ref-check)
  forbidTime?: boolean;
  forbidEvent?: boolean;
}

function checkExpr(src: unknown, path: string, opts: ExprCheck, errors: ValidationError[]): void {
  if (typeof src !== "string") {
    errors.push({ path, message: "Expected an expression string." });
    return;
  }
  let compiled;
  try {
    compiled = compile(src);
  } catch (e) {
    const msg = e instanceof ExprError ? e.message : String(e);
    errors.push({ path, message: msg });
    return;
  }
  for (const call of compiled.calls) {
    if (call === "time") {
      errors.push({
        path,
        message: opts.forbidTime
          ? `Binding ${path} reads \`time()\` directly. Time must enter through state via tick payload \`event.now\`.`
          : "`time()` is not a runtime helper. Pass time through state via the tick payload.",
      });
      continue;
    }
    if (!HELPER_NAMES.has(call)) {
      errors.push({
        path,
        message: `Unknown helper \`${call}()\`. Closed helpers: ${[...HELPER_NAMES].sort().join(", ")}.`,
      });
    }
  }
  // `time()` is already reported in the calls loop above; only the event
  // payload is the concern here (avoids a doubled message for `time()`).
  if (opts.forbidEvent && compiled.refs.has("event")) {
    errors.push({ path, message: `${path} may not read the event payload — bindings are pure over state.` });
  }
  if (opts.knownRefs) {
    for (const ref of compiled.refs) {
      // `event` under forbidEvent is reported once above — don't also flag it
      // here as an "unknown reference".
      if (ref === "event" && opts.forbidEvent) continue;
      if (!opts.knownRefs.has(ref)) {
        errors.push({ path, message: `Unknown reference \`${ref}\` in ${path}.` });
      }
    }
  }
}

/** Merge the observation schemas of every codeProbe harness in `display`.
    The reaction-level typed check below validates `obs:<kind>` field reads
    against this — the §11 "interface check" that an author can't read a
    field the harness never emits. */
function gatherObsSchema(display: unknown): ObservationSchema {
  const merged: ObservationSchema = {};
  if (!Array.isArray(display)) return merged;
  for (const layer of display) {
    if (!isObj(layer) || layer.type !== "codeProbe") continue;
    const ref = layer.harness;
    const id = isObj(ref) ? ref.id : undefined;
    if (typeof id !== "string") continue;
    const h = getHarness(id);
    if (!isObservationHarness(h)) continue;
    for (const [kind, ks] of Object.entries(h.observationSchema)) {
      const cur = merged[kind];
      merged[kind] = { fields: { ...(cur?.fields ?? {}), ...ks.fields }, doc: cur?.doc ?? ks.doc };
    }
  }
  return merged;
}

/** Collect every property read as `event.<prop>` in an expression. */
function eventFieldReads(src: unknown): Set<string> {
  const out = new Set<string>();
  if (typeof src !== "string") return out;
  let ast: Ast;
  try {
    ast = compile(src).ast;
  } catch {
    return out;
  }
  const walk = (a: Ast): void => {
    if (a.k === "member" && a.obj.k === "ident" && a.obj.name === "event") out.add(a.prop);
    switch (a.k) {
      case "array":
        a.items.forEach(walk);
        break;
      case "member":
        walk(a.obj);
        break;
      case "index":
        walk(a.obj);
        walk(a.index);
        break;
      case "call":
        a.args.forEach(walk);
        break;
      case "unary":
        walk(a.arg);
        break;
      case "binary":
      case "logical":
        walk(a.left);
        walk(a.right);
        break;
      default:
        break;
    }
  };
  walk(ast);
  return out;
}

export function validateSpec(input: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  if (!isObj(input)) {
    return { ok: false, errors: [{ path: "spec", message: "A spec must be an object." }], warnings };
  }
  if (input.type !== "reactive") {
    errors.push({ path: "spec.type", message: 'Reactive specs must declare `type: "reactive"`.' });
  }
  if (!isObj(input.state)) {
    errors.push({ path: "spec.state", message: "`state` must be an object of initial values." });
    return { ok: false, errors, warnings };
  }

  const stateKeys = new Set(Object.keys(input.state));
  const bindings = isObj(input.bindings) ? (input.bindings) : {};
  const bindingKeys = new Set(Object.keys(bindings));

  // state/binding key collision (§3.3)
  for (const k of bindingKeys) {
    if (stateKeys.has(k)) {
      errors.push({ path: `spec.bindings.${k}`, message: `Key "${k}" appears in both state and bindings.` });
    }
  }

  const bindingRefs = new Set<string>([...stateKeys, ...bindingKeys, "state", "bindings"]);
  for (const [k, v] of Object.entries(bindings)) {
    checkExpr(v, `binding \`${k}\``, { knownRefs: bindingRefs, forbidTime: true, forbidEvent: true }, errors);
  }

  // binding cycle / unknown structure (§3.3)
  if (errors.length === 0) {
    try {
      bindingOrder(input.state as Record<string, Value>, bindings as Record<string, string>);
    } catch (e) {
      if (e instanceof VMError) errors.push({ path: "spec.bindings", message: e.message });
      else throw e;
    }
  }

  // ── Display layers: structured surface (preferred) or legacy array ──
  // Collected up front because the reaction checks below need the merged
  // observation schema of every codeProbe, wherever it was declared.
  const structured = input.stage !== undefined;
  const layerList: { layer: Record<string, unknown>; path: string }[] = [];
  const pushLayer = (v: unknown, path: string): void => {
    if (isObj(v)) layerList.push({ layer: v, path });
    else errors.push({ path, message: "Expected a display layer object." });
  };

  if (structured) {
    if (input.display !== undefined) {
      errors.push({
        path: "spec.display",
        message: "Use either the structured fields (stage/readouts/code/…) or a raw `display` array — not both.",
      });
    }
    if (input.code !== undefined) {
      if (isObj(input.code) && input.code.type !== "codeProbe") {
        errors.push({ path: "spec.code.type", message: "`code` must be a codeProbe layer." });
      }
      pushLayer(input.code, "spec.code");
    }
    pushLayer(input.stage, "spec.stage");
    const st = isObj(input.stage) ? input.stage : null;
    if (st && typeof st.type === "string" && !STAGE_KINDS.has(st.type)) {
      errors.push({
        path: "spec.stage.type",
        message: `The stage must be a rich visual (${[...STAGE_KINDS].join(", ")}); got "${st.type}". Text never carries an exercise.`,
      });
    }
    if (st && typeof st.type === "string" && LOW_DENSITY_STAGE.has(st.type)) {
      warnings.push(
        `visualDensity: stage "${st.type}" is a low-density visual — prefer arena, plot, graph, or diagramScene when the model allows.`,
      );
    }
    if (input.readouts !== undefined) {
      if (!Array.isArray(input.readouts)) {
        errors.push({ path: "spec.readouts", message: "`readouts` must be an array of quiet text layers." });
      } else {
        if (input.readouts.length > 2) {
          errors.push({
            path: "spec.readouts",
            message: `Text budget: at most 2 readouts (got ${input.readouts.length}). Let the stage do the talking.`,
          });
        }
        input.readouts.forEach((r, i) => {
          if (isObj(r) && typeof r.type === "string" && !READOUT_KINDS.has(r.type)) {
            errors.push({
              path: `spec.readouts[${i}].type`,
              message: `Readouts may only be quiet text layers (${[...READOUT_KINDS].join(", ")}); got "${r.type}".`,
            });
          }
          pushLayer(r, `spec.readouts[${i}]`);
        });
      }
    }
    if (input.controls !== undefined) {
      if (isObj(input.controls) && input.controls.type !== "controls") {
        errors.push({ path: "spec.controls.type", message: "`controls` must be a controls layer." });
      }
      pushLayer(input.controls, "spec.controls");
    }
    if (input.player !== undefined) {
      if (isObj(input.player) && input.player.type !== "observationPlayer") {
        errors.push({ path: "spec.player.type", message: "`player` must be an observationPlayer layer." });
      }
      pushLayer(input.player, "spec.player");
    }
    if (typeof input.prompt !== "string" || input.prompt.trim() === "") {
      errors.push({ path: "spec.prompt", message: "Structured specs require a `prompt`." });
    }
    if (typeof input.criticalThinking !== "string" || input.criticalThinking.trim() === "") {
      errors.push({
        path: "spec.criticalThinking",
        message: "Structured specs require `criticalThinking` — one question that pushes past the mechanics.",
      });
    }
  } else if (!Array.isArray(input.display)) {
    errors.push({ path: "spec.display", message: "A spec needs a `stage` (preferred) or a `display` array." });
  } else {
    input.display.forEach((l, li) => pushLayer(l, `display[${li}]`));
    // Legacy form gets the same graphical bar as warnings (errors once the
    // remaining fixtures migrate to the structured surface).
    const kinds = layerList.map((l) => (typeof l.layer.type === "string" ? l.layer.type : ""));
    if (!kinds.some((k) => STAGE_KINDS.has(k))) {
      warnings.push("visualDensity: no rich visual layer — stage one (arena, plot, graph, diagramScene, …).");
    }
    const primary = kinds.find((k) => k !== "codeProbe" && k !== "controls" && k !== "observationPlayer");
    if (primary && (READOUT_KINDS.has(primary) || primary === "cards")) {
      warnings.push("visualDensity: text is the primary display — lead with a rich visual.");
    }
    const texty = kinds.filter((k) => READOUT_KINDS.has(k) || k === "cards").length;
    if (texty > 2) warnings.push(`visualDensity: ${texty} text layers — the budget is 2.`);
    if (typeof input.criticalThinking !== "string" || input.criticalThinking.trim() === "") {
      warnings.push("No `criticalThinking` question — every exercise should push past its mechanics.");
    }
  }

  // reactions (§3.4)
  const obsSchema = gatherObsSchema(layerList.map((l) => l.layer));
  const reactions = Array.isArray(input.reactions) ? input.reactions : [];
  const crossWrites = new Map<string, number>();
  reactions.forEach((r, ri) => {
    if (!isObj(r)) {
      errors.push({ path: `reactions[${ri}]`, message: "A reaction must be an object." });
      return;
    }
    if (typeof r.on !== "string") errors.push({ path: `reactions[${ri}].on`, message: "Reaction needs an `on` event type." });
    if (typeof r.when === "string") {
      checkExpr(r.when, `reactions[${ri}].when`, { knownRefs: null }, errors);
    }
    const doList = Array.isArray(r.do) ? r.do : [];
    const seen = new Set<string>();
    doList.forEach((a, ai) => {
      if (!isObj(a) || typeof a.set !== "string") {
        errors.push({ path: `reactions[${ri}].do[${ai}]`, message: "Each assignment needs a `set` key and a `to` expression." });
        return;
      }
      if (!stateKeys.has(a.set)) {
        errors.push({ path: `reactions[${ri}].do[${ai}]`, message: `Reaction assigns unknown state key "${a.set}".` });
      }
      if (seen.has(a.set)) {
        errors.push({ path: `reactions[${ri}].do[${ai}]`, message: `Reaction writes "${a.set}" twice in one atomic reaction.` });
      }
      seen.add(a.set);
      checkExpr(a.to, `reactions[${ri}].do[${ai}].to`, { knownRefs: null }, errors);
    });

    // §11 typed-interface check: a reaction folding an `obs:<kind>` event may
    // only read fields the harness actually emits for that kind.
    const obsMatch = typeof r.on === "string" ? /^obs:(.+)$/.exec(r.on) : null;
    const kind = obsMatch?.[1];
    if (kind && obsSchema[kind]) {
      const allowed = new Set([...Object.keys(obsSchema[kind].fields), "kind", "t"]);
      const checkObsFields = (src: unknown, sub: string): void => {
        for (const f of eventFieldReads(src)) {
          if (!allowed.has(f)) {
            errors.push({
              path: sub,
              message: `Reaction on \`${String(r.on)}\` reads \`event.${f}\`, which the \`${kind}\` observation does not emit. Available: ${[...allowed].join(", ")}.`,
            });
          }
        }
      };
      if (typeof r.when === "string") checkObsFields(r.when, `reactions[${ri}].when`);
      doList.forEach((a, ai) => {
        if (isObj(a)) checkObsFields(a.to, `reactions[${ri}].do[${ai}].to`);
      });
    }

    for (const key of seen) {
      const prior = crossWrites.get(key) ?? 0;
      if (prior > 0 && r.allowSequentialWrite !== true) {
        warnings.push(
          `State key "${key}" is written by multiple reactions; order-dependent. Mark \`allowSequentialWrite: true\` to silence.`,
        );
      }
      crossWrites.set(key, prior + 1);
    }
  });

  // evaluator
  if (input.evaluator !== undefined) {
    if (!isObj(input.evaluator) || typeof input.evaluator.ok !== "string") {
      errors.push({ path: "spec.evaluator", message: "`evaluator` needs an `ok` boolean expression." });
    } else {
      // Note: the evaluator env is state+bindings only — `eval` is a *display*
      // alias (it carries the evaluator's own result), so it is NOT readable here.
      const evalRefs = new Set<string>([...stateKeys, ...bindingKeys, "state", "bindings"]);
      checkExpr(input.evaluator.ok, "evaluator.ok", { knownRefs: evalRefs }, errors);
      if (typeof input.evaluator.proximity === "string") {
        checkExpr(input.evaluator.proximity, "evaluator.proximity", { knownRefs: evalRefs }, errors);
      }
    }
  }

  // tick
  if (isObj(input.tick) && input.tick.fps !== undefined) {
    const ok = [1, 2, 5, 10, 15, 30].includes(input.tick.fps as number);
    if (!ok) errors.push({ path: "spec.tick.fps", message: "tick.fps must be one of 1, 2, 5, 10, 15, 30." });
  }

  // display (§6 enum + §2.2 codeProbe compatibility) — over every collected
  // layer, structured or legacy, with its origin path in each message.
  const displayRefs = new Set<string>([...stateKeys, ...bindingKeys, "state", "bindings", "eval"]);
  for (const { layer, path } of layerList) {
    if (typeof layer.type !== "string") {
      errors.push({ path, message: "Each display layer needs a `type`." });
      continue;
    }
    if (layer.type === "canvasScene") {
      errors.push({
        path,
        message: "DisplayLayer `canvasScene` is not allowed in the default DSL. Use `diagramScene` or a module.",
      });
      continue;
    }
    if (!ALLOWED_DISPLAY.has(layer.type)) {
      errors.push({
        path: `${path}.type`,
        message: `Unknown display type "${layer.type}". Allowed: ${[...ALLOWED_DISPLAY].join(", ")}.`,
      });
      continue;
    }
    if (layer.showWhen != null) {
      checkExpr(layer.showWhen, `${path}.showWhen`, { knownRefs: displayRefs }, errors);
    }
    if (layer.type === "codeProbe") {
      validateCodeProbe(layer, path, errors);
      continue;
    }
    validateDisplayLayer(layer, path, displayRefs, errors);
  }

  return { ok: errors.length === 0, errors, warnings };
}

/* ── Display-expression validation (§6) ──────────────────────────────
   The layers below evaluate their expression fields eagerly through `run()`
   with no fallback, so a bad ref crashes the renderer at paint time. We
   reject those up front. `text`/`richText`/`stateBadge` are intentionally
   lenient — their renderers treat an un-parseable value as literal prose. */
function validateDisplayLayer(
  layer: Record<string, unknown>,
  path: string,
  refs: Set<string>,
  errors: ValidationError[],
): void {
  const ck = (src: unknown, sub: string): void =>
    checkExpr(src, `${path}.${sub}`, { knownRefs: refs }, errors);

  switch (layer.type) {
    case "numberLine":
      ck(layer.value, "value");
      if (layer.target != null) ck(layer.target, "target");
      break;
    case "cards":
      ck(layer.items, "items");
      break;
    case "tape":
      ck(layer.cells, "cells");
      ck(layer.head, "head");
      break;
    case "sequence":
      ck(layer.items, "items");
      if (layer.cursor != null) ck(layer.cursor, "cursor");
      if (layer.orientation != null && layer.orientation !== "row" && layer.orientation !== "stack") {
        errors.push({ path: `${path}.orientation`, message: 'sequence.orientation must be "row" or "stack".' });
      }
      break;
    case "observationPlayer": {
      if (layer.source != null) ck(layer.source, "source");
      if (layer.version != null) ck(layer.version, "version");
      const pb = layer.playback;
      if (pb != null) {
        if (!isObj(pb) || typeof pb.mode !== "string" || !PLAYBACK_MODES.has(pb.mode)) {
          errors.push({ path: `${path}.playback.mode`, message: 'playback.mode must be "instant", "auto", or "step".' });
        } else if (pb.fps != null && (typeof pb.fps !== "number" || pb.fps <= 0)) {
          errors.push({ path: `${path}.playback.fps`, message: "playback.fps must be a positive number." });
        }
      }
      break;
    }
    case "controls": {
      const ctrls = Array.isArray(layer.controls) ? layer.controls : [];
      ctrls.forEach((c, ci) => {
        if (!isObj(c)) {
          errors.push({ path: `${path}.controls[${ci}]`, message: "A control must be an object." });
          return;
        }
        if (typeof c.event !== "string") {
          errors.push({ path: `${path}.controls[${ci}].event`, message: "A control needs an `event` type." });
        }
        if (typeof c.disabledWhen === "string") ck(c.disabledWhen, `controls[${ci}].disabledWhen`);
        if (typeof c.value === "string") ck(c.value, `controls[${ci}].value`);
        // A slider is a CONTROLLED input: its `value` must track the state its
        // event updates, or React snaps the thumb back and it can't be dragged.
        // A constant value (no state refs, e.g. value="1") is always this bug.
        if (c.type === "slider" && typeof c.value === "string") {
          let refsEmpty = false;
          try {
            refsEmpty = compile(c.value).refs.size === 0;
          } catch {
            /* malformed expr already reported by ck above */
          }
          if (refsEmpty) {
            errors.push({
              path: `${path}.controls[${ci}].value`,
              message: `A slider's \`value\` must reference the state its event updates (e.g. value="step"), so the thumb reflects its position. The constant value="${c.value}" can't move — bind it to state.`,
            });
          }
        }
        if (typeof c.min === "string") ck(c.min, `controls[${ci}].min`);
        if (typeof c.max === "string") ck(c.max, `controls[${ci}].max`);
        if (isObj(c.payload)) {
          for (const [pk, pe] of Object.entries(c.payload)) ck(pe, `controls[${ci}].payload.${pk}`);
        }
      });
      break;
    }
    case "arena": {
      ck(layer.blocks, "blocks");
      const regions = Array.isArray(layer.regions) ? layer.regions : null;
      if (!regions || regions.length === 0) {
        errors.push({ path: `${path}.regions`, message: "arena needs a non-empty `regions` array." });
        break;
      }
      const regionIds = new Set<string>();
      regions.forEach((r, ri) => {
        if (!isObj(r) || typeof r.id !== "string") {
          errors.push({ path: `${path}.regions[${ri}].id`, message: "Each arena region needs a string `id`." });
          return;
        }
        if (regionIds.has(r.id)) errors.push({ path: `${path}.regions[${ri}].id`, message: `Duplicate region id "${r.id}".` });
        regionIds.add(r.id);
        if (r.capacity != null && (typeof r.capacity !== "number" || r.capacity <= 0)) {
          errors.push({ path: `${path}.regions[${ri}].capacity`, message: "region.capacity must be a positive number (omit for unbounded)." });
        }
      });
      const of = layer.overflow;
      if (of != null) {
        if (!isObj(of) || typeof of.from !== "string" || typeof of.to !== "string") {
          errors.push({ path: `${path}.overflow`, message: "arena.overflow needs `from` and `to` region ids." });
        } else {
          if (!regionIds.has(of.from)) errors.push({ path: `${path}.overflow.from`, message: `overflow.from "${of.from}" is not a region id.` });
          if (!regionIds.has(of.to)) errors.push({ path: `${path}.overflow.to`, message: `overflow.to "${of.to}" is not a region id.` });
        }
      }
      break;
    }
    case "plot": {
      const series = Array.isArray(layer.series) ? layer.series : null;
      if (!series || series.length === 0) {
        errors.push({ path: `${path}.series`, message: "plot needs a non-empty `series` array." });
        break;
      }
      series.forEach((s, si) => {
        if (!isObj(s) || typeof s.points !== "string") {
          errors.push({ path: `${path}.series[${si}].points`, message: "Each series needs a `points` expression." });
          return;
        }
        ck(s.points, `series[${si}].points`);
      });
      if (isObj(layer.target)) {
        if (typeof layer.target.points !== "string") errors.push({ path: `${path}.target.points`, message: "plot.target needs a `points` expression." });
        else ck(layer.target.points, "target.points");
      }
      if (isObj(layer.cursor)) {
        ck(layer.cursor.x, "cursor.x");
        ck(layer.cursor.y, "cursor.y");
      }
      break;
    }
    case "graph": {
      ck(layer.nodes, "nodes");
      if (layer.edges != null) ck(layer.edges, "edges");
      if (
        layer.layout != null &&
        !["tree", "layered", "stack", "row", "ring"].includes(layer.layout as string)
      ) {
        errors.push({ path: `${path}.layout`, message: 'graph.layout must be one of "tree", "layered", "stack", "row", "ring".' });
      }
      break;
    }
    case "diagramScene": {
      const scene = layer.scene;
      if (!isObj(scene) || !Array.isArray(scene.shapes)) {
        errors.push({ path: `${path}.scene`, message: "diagramScene needs a `scene` with a `shapes` array." });
        break;
      }
      scene.shapes.forEach((s, si) => {
        if (!isObj(s) || typeof s.type !== "string") {
          errors.push({ path: `${path}.scene.shapes[${si}]`, message: "Each shape needs a `type`." });
          return;
        }
        for (const { sub, src } of shapeExprPairs(s)) {
          ck(src, `scene.shapes[${si}].${sub}`);
        }
      });
      break;
    }
    default:
      // text / richText / stateBadge: renderer falls back to literal prose.
      break;
  }
}

/** The expression-valued fields of a tokenized shape, by name. */
function shapeExprPairs(s: Record<string, unknown>): { sub: string; src: unknown }[] {
  const out: { sub: string; src: unknown }[] = [];
  const flat = (k: string): void => {
    if (s[k] !== undefined) out.push({ sub: k, src: s[k] });
  };
  const pt = (k: string): void => {
    const p = s[k];
    if (isObj(p)) {
      out.push({ sub: `${k}.x`, src: p.x });
      out.push({ sub: `${k}.y`, src: p.y });
    }
  };
  switch (s.type) {
    case "circle":
      flat("cx");
      flat("cy");
      flat("r");
      break;
    case "rect":
      flat("x");
      flat("y");
      flat("w");
      flat("h");
      break;
    case "line":
      flat("x1");
      flat("y1");
      flat("x2");
      flat("y2");
      break;
    case "arrow":
      pt("from");
      pt("to");
      break;
    case "label":
      pt("at");
      break;
    case "path":
      flat("points");
      break;
    default:
      break;
  }
  return out;
}

function validateCodeProbe(layer: Record<string, unknown>, path: string, errors: ValidationError[]): void {
  const harnessRef = layer.harness;
  const harnessId = isObj(harnessRef) ? harnessRef.id : undefined;
  if (typeof harnessId !== "string") {
    errors.push({ path: `${path}.harness`, message: "codeProbe needs a harness reference `{ id }`." });
    return;
  }
  const harness = getHarness(harnessId);
  if (!harness) {
    errors.push({
      path: `${path}.harness`,
      message: `Unknown harness "${harnessId}". Registered: ${Object.keys(HARNESSES).join(", ")}.`,
    });
    return;
  }
  const editMode = layer.editMode;
  const compat = HARNESS_EDIT_COMPAT[harness.kind] ?? [];
  if (typeof editMode === "string" && !compat.includes(editMode as never)) {
    errors.push({
      path: `${path}.editMode`,
      message: `codeProbe editMode \`${editMode}\` is incompatible with harness \`${harnessId}\` type \`${harness.kind}\`. Use ${compat
        .map((m) => `\`${m}\``)
        .join(" or ")}.`,
    });
  }
  // curated-trace harness must have passing ground-truth tests (§2.1)
  if (harness.kind === "curated-trace") {
    const ct = harness as unknown as { groundTruthTests?: unknown[] };
    if (!Array.isArray(ct.groundTruthTests) || ct.groundTruthTests.length === 0) {
      errors.push({
        path: `${path}.harness`,
        message: `Curated-trace harness \`${harnessId}\` has no ground-truth oracle tests.`,
      });
    }
  }

  // source regions: structural integrity (§5 codeProbe).
  const source = layer.source;
  if (!Array.isArray(source)) {
    errors.push({ path: `${path}.source`, message: "codeProbe needs a `source` array of regions." });
    return;
  }
  const ids = new Set<string>();
  let holes = 0;
  let editables = 0;
  source.forEach((r, si) => {
    const rp = `${path}.source[${si}]`;
    if (!isObj(r) || typeof r.kind !== "string") {
      errors.push({ path: rp, message: "Each source region needs a `kind`." });
      return;
    }
    if (typeof r.id === "string") {
      if (ids.has(r.id)) errors.push({ path: `${rp}.id`, message: `Duplicate region id "${r.id}".` });
      ids.add(r.id);
    } else {
      errors.push({ path: `${rp}.id`, message: "Each source region needs a string `id`." });
    }
    switch (r.kind) {
      case "locked":
        if (typeof r.text !== "string") errors.push({ path: rp, message: "A `locked` region needs `text`." });
        break;
      case "editableText":
        editables++;
        if (typeof r.initial !== "string") errors.push({ path: rp, message: "An `editableText` region needs `initial`." });
        break;
      case "blankHole":
        holes++;
        if (typeof r.placeholder !== "string") errors.push({ path: rp, message: "A `blankHole` needs a `placeholder`." });
        break;
      case "choiceHole":
        holes++;
        if (!Array.isArray(r.choices) || r.choices.length === 0) {
          errors.push({ path: rp, message: "A `choiceHole` needs at least one choice." });
        }
        break;
      default:
        errors.push({ path: `${rp}.kind`, message: `Unknown region kind "${r.kind}".` });
    }
  });
  if (editMode === "holes" && holes === 0) {
    errors.push({ path: `${path}.editMode`, message: "editMode `holes` requires at least one hole region." });
  }
  if (editMode === "multiRegionFreeText" && editables === 0) {
    errors.push({
      path: `${path}.editMode`,
      message: "editMode `multiRegionFreeText` requires at least one `editableText` region — otherwise there is nothing to edit.",
    });
  }
}
