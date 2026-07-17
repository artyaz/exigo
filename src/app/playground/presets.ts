/* Reactive-VM specs that exercise distinct corners of the runtime:
   events + evaluator, collections + closed helpers, tick + pure bindings
   + tokenized scene, and the real-execution codeProbe. Authored as data
   so the playground editor round-trips them through JSON. */
import type { ReactiveSpec } from "../_components/exercises";

export interface Preset {
  id: string;
  label: string;
  spec: ReactiveSpec;
}

const counter: ReactiveSpec = {
  type: "reactive",
  prompt: "Drive the counter to **5**.",
  criticalThinking: "When does state live in UI controls vs. elsewhere, and why does the split matter?",
  accent: "emerald",
  state: { n: 0 },
  bindings: { remaining: "5 - n" },
  reactions: [
    { on: "inc", do: [{ set: "n", to: "min(n + 1, 9)" }] },
    { on: "dec", allowSequentialWrite: true, do: [{ set: "n", to: "max(n - 1, 0)" }] },
  ],
  evaluator: { ok: "n == 5", msgOk: "Exactly five.", proximity: "1 - abs(5 - n) / 5" },
  evaluatePolicy: { onEvent: true, onSubmit: false },
  stage: { type: "numberLine", value: "n", target: "5", min: 0, max: 9 },
  readouts: [
    { type: "stateBadge", label: "n", value: "n" },
    { type: "stateBadge", label: "remaining", value: "remaining" },
  ],
  controls: {
    type: "controls",
    controls: [
      { type: "button", label: "− 1", event: "dec", disabledWhen: "n <= 0" },
      { type: "button", label: "+ 1", event: "inc", disabledWhen: "n >= 9" },
    ],
  },
};

const tape: ReactiveSpec = {
  type: "reactive",
  prompt: "Walk the head and flip cells until the tape reads **all ones**.",
  criticalThinking: "Turing machines pair state with a tape position — why does separating the hand from the cells matter?",
  accent: "azure",
  state: { cells: ["1", "0", "1", "0"], head: 0 },
  reactions: [
    { on: "left", do: [{ set: "head", to: "max(head - 1, 0)" }] },
    { on: "right", do: [{ set: "head", to: "min(head + 1, len(cells) - 1)" }] },
    { on: "flip", do: [{ set: "cells", to: 'setAt(cells, head, if(at(cells, head) == "1", "0", "1"))' }] },
  ],
  evaluator: { ok: 'count(cells, "1") == len(cells)', msgOk: "All ones.", proximity: 'count(cells, "1") / len(cells)' },
  evaluatePolicy: { onEvent: true, onSubmit: false },
  stage: { type: "tape", cells: "cells", head: "head" },
  controls: {
    type: "controls",
    controls: [
      { type: "button", label: "◀ left", event: "left", disabledWhen: "head <= 0" },
      { type: "button", label: "flip", event: "flip" },
      { type: "button", label: "right ▶", event: "right", disabledWhen: "head >= len(cells) - 1" },
    ],
  },
};

const orbit: ReactiveSpec = {
  type: "reactive",
  prompt: "A dot sweeps the track. **Time enters as state**, never as `time()`.",
  criticalThinking: "Why can bindings never call `time()` and must read `t` from state instead?",
  accent: "violet",
  state: { t: 0 },
  bindings: { phase: "mod(t, 60)", px: "abs(phase / 30 - 1)" },
  tick: { enabled: true, fps: 15, pauseWhenHidden: true },
  reactions: [{ on: "tick", do: [{ set: "t", to: "t + 1" }] }],
  stage: {
    type: "diagramScene",
    scene: {
      coordinateSystem: "unit",
      width: 100,
      height: 40,
      shapes: [
        { type: "line", x1: "0.05", y1: "0.5", x2: "0.95", y2: "0.5", tone: "ghost" },
        { type: "circle", cx: "0.05 + px * 0.9", cy: "0.5", r: "0.06", tone: "violet" },
      ],
    },
  },
  readouts: [{ type: "stateBadge", label: "t", value: "t" }],
};

const probe: ReactiveSpec = {
  type: "reactive",
  prompt: "Fill the holes so the program logs **3**, then a doubled **6**.",
  criticalThinking: "How do `trace()` and `result()` let you surface rows from running code, and why doesn't `console.log` work here?",
  accent: "amber",
  state: { passed: false },
  reactions: [{ on: "ran", do: [{ set: "passed", to: "event.ok" }] }],
  evaluator: { ok: "passed", msgOk: "It ran clean." },
  evaluatePolicy: { onEvent: true, onSubmit: false },
  code: {
    type: "codeProbe",
    language: "javascript",
    harness: { id: "js-real-execution" },
    editMode: "holes",
    runMode: "manualRun",
    event: "ran",
    source: [
      { kind: "locked", id: "l1", text: "const x = " },
      { kind: "blankHole", id: "a", placeholder: "3", maxChars: 4 },
      { kind: "locked", id: "l2", text: ';\ntrace("x", x);\nresult("2x", x * ' },
      { kind: "blankHole", id: "b", placeholder: "2", maxChars: 4 },
      { kind: "locked", id: "l3", text: ");" },
    ],
  },
  stage: { type: "numberLine", value: "0", min: 0, max: 1 },
  readouts: [{ type: "stateBadge", label: "passed", value: 'if(passed, "yes", "no")' }],
};

/* ── Code → visualization presets ────────────────────────────────────
   Each runs real JS, computes ready-to-render geometry, and hands it back
   through `result(label, value)`. The reaction stores it via
   `event.out.<label>`; the scene reads it. No array maths in author space —
   the loops all live in the (real) learner code. */

const plot: ReactiveSpec = {
  type: "reactive",
  prompt: "Fill the body of `f(x)` so the plotted curve **rises** left-to-right. Try `x * x`.",
  criticalThinking: "Why is letting code return pre-computed points better than authoring coordinates in the DSL?",
  accent: "amber",
  state: { curve: [], n: 0 },
  reactions: [
    {
      on: "plot",
      when: "event.ok",
      do: [
        { set: "curve", to: "event.out.curve" },
        { set: "n", to: "event.out.n" },
      ],
    },
  ],
  evaluator: {
    ok: "n > 0 && at(at(curve, n - 1), 1) < at(at(curve, 0), 1)",
    msgOk: "It rises.",
    msgNo: "Plot a function whose right end sits above its left end.",
  },
  evaluatePolicy: { onEvent: true, onSubmit: false },
  code: {
    type: "codeProbe",
    language: "javascript",
    harness: { id: "js-real-execution" },
    editMode: "holes",
    runMode: "manualRun",
    event: "plot",
    source: [
      { kind: "locked", id: "l1", text: "const f = (x) => " },
      { kind: "blankHole", id: "f", placeholder: "x * x", maxChars: 24 },
      {
        kind: "locked",
        id: "l2",
        text:
          ";\n" +
          "const pts = [];\n" +
          "for (let i = 0; i <= 40; i++) {\n" +
          "  const x = i / 40;\n" +
          "  let y = f(x);\n" +
          "  if (!Number.isFinite(y)) y = 0;\n" +
          "  y = Math.max(0, Math.min(1, y));\n" +
          "  pts.push([x, 1 - y]);\n" +
          "}\n" +
          'result("curve", pts);\n' +
          'result("n", pts.length);',
      },
    ],
  },
  stage: {
    type: "diagramScene",
    scene: {
      coordinateSystem: "unit",
      width: 100,
      height: 100,
      shapes: [
        { type: "line", x1: "0.02", y1: "0.98", x2: "0.98", y2: "0.98", tone: "ghost" },
        { type: "line", x1: "0.02", y1: "0.04", x2: "0.02", y2: "0.98", tone: "ghost" },
        { type: "path", points: "curve", tone: "amber" },
      ],
    },
  },
  readouts: [{ type: "stateBadge", label: "points", value: "n" }],
};

const recursion: ReactiveSpec = {
  type: "reactive",
  prompt: "Fix the **base case** so `fact(5)` returns **120**, and watch the call stack build.",
  criticalThinking: "Each recursive call is a frame pushing onto the stack — why must it unwind before the next can start?",
  accent: "violet",
  state: { stack: [], result: 0 },
  reactions: [
    {
      on: "call",
      when: "event.ok",
      do: [
        { set: "stack", to: "event.out.stack" },
        { set: "result", to: "event.out.result" },
      ],
    },
  ],
  evaluator: { ok: "result == 120", msgOk: "5! = 120." },
  evaluatePolicy: { onEvent: true, onSubmit: false },
  code: {
    type: "codeProbe",
    language: "javascript",
    harness: { id: "js-real-execution" },
    editMode: "holes",
    runMode: "manualRun",
    event: "call",
    source: [
      {
        kind: "locked",
        id: "l1",
        text:
          "const stack = [];\n" +
          "function fact(n) {\n" +
          "  stack.push([n, stack.length]);\n" +
          "  if (n <= 1) return ",
      },
      { kind: "blankHole", id: "base", placeholder: "1", maxChars: 4 },
      {
        kind: "locked",
        id: "l2",
        text:
          ";\n" +
          "  return n * fact(n - 1);\n" +
          "}\n" +
          "const r = fact(5);\n" +
          'result("stack", stack);\n' +
          'result("result", r);',
      },
    ],
  },
  stage: {
    type: "diagramScene",
    scene: {
      coordinateSystem: "unit",
      width: 100,
      height: 100,
      shapes: [
        { type: "line", x1: "0.06", y1: "0.94", x2: "0.94", y2: "0.94", tone: "ghost" },
        { type: "rect", x: "0.08", y: "0.80", w: "at(at(stack, 0), 0) / 6", h: "0.12", tone: "violet" },
        { type: "rect", x: "0.08", y: "0.64", w: "at(at(stack, 1), 0) / 6", h: "0.12", tone: "violet" },
        { type: "rect", x: "0.08", y: "0.48", w: "at(at(stack, 2), 0) / 6", h: "0.12", tone: "violet" },
        { type: "rect", x: "0.08", y: "0.32", w: "at(at(stack, 3), 0) / 6", h: "0.12", tone: "violet" },
        { type: "rect", x: "0.08", y: "0.16", w: "at(at(stack, 4), 0) / 6", h: "0.12", tone: "violet" },
      ],
    },
  },
  readouts: [{ type: "stateBadge", label: "fact(5)", value: "result" }],
};

const sorting: ReactiveSpec = {
  type: "reactive",
  prompt: "Pick the comparator, run the sort, then **drag the slider** to replay each swap.",
  criticalThinking: "Bubble sort records every state between swaps — why is replaying the *steps*, not just the final order, the key insight?",
  accent: "azure",
  state: { steps: [[5, 3, 8, 1, 9, 2]], i: 0, k: 1 },
  reactions: [
    {
      on: "go",
      when: "event.ok",
      do: [
        { set: "steps", to: "event.out.steps" },
        { set: "k", to: "event.out.k" },
        { set: "i", to: "0" },
      ],
    },
    { on: "scrub", allowSequentialWrite: true, do: [{ set: "i", to: "clamp(event.value, 0, k - 1)" }] },
  ],
  evaluator: { ok: "true", msgOk: "Good." },
  evaluatePolicy: { onEvent: true, onSubmit: false },
  code: {
    type: "codeProbe",
    language: "javascript",
    harness: { id: "js-real-execution" },
    editMode: "holes",
    runMode: "manualRun",
    event: "go",
    source: [
      {
        kind: "locked",
        id: "l1",
        text:
          "const a = [5, 3, 8, 1, 9, 2];\n" +
          "const steps = [a.slice()];\n" +
          "for (let p = 0; p < a.length; p++) {\n" +
          "  for (let j = 0; j + 1 < a.length; j++) {\n" +
          "    if (a[j] ",
      },
      {
        kind: "choiceHole",
        id: "cmp",
        choices: [
          { id: "gt", text: ">", label: "a[j] > a[j+1]  (ascending)" },
          { id: "lt", text: "<", label: "a[j] < a[j+1]  (descending)" },
        ],
      },
      {
        kind: "locked",
        id: "l2",
        text:
          " a[j + 1]) {\n" +
          "      const t = a[j];\n" +
          "      a[j] = a[j + 1];\n" +
          "      a[j + 1] = t;\n" +
          "      steps.push(a.slice());\n" +
          "    }\n" +
          "  }\n" +
          "}\n" +
          'result("steps", steps);\n' +
          'result("k", steps.length);',
      },
    ],
  },
  stage: {
    type: "diagramScene",
    scene: {
      coordinateSystem: "unit",
      width: 100,
      height: 100,
      shapes: [
        { type: "rect", x: "0.06", y: "1 - at(at(steps, i), 0) / 10", w: "0.1", h: "at(at(steps, i), 0) / 10", tone: "azure" },
        { type: "rect", x: "0.21", y: "1 - at(at(steps, i), 1) / 10", w: "0.1", h: "at(at(steps, i), 1) / 10", tone: "azure" },
        { type: "rect", x: "0.36", y: "1 - at(at(steps, i), 2) / 10", w: "0.1", h: "at(at(steps, i), 2) / 10", tone: "azure" },
        { type: "rect", x: "0.51", y: "1 - at(at(steps, i), 3) / 10", w: "0.1", h: "at(at(steps, i), 3) / 10", tone: "azure" },
        { type: "rect", x: "0.66", y: "1 - at(at(steps, i), 4) / 10", w: "0.1", h: "at(at(steps, i), 4) / 10", tone: "azure" },
        { type: "rect", x: "0.81", y: "1 - at(at(steps, i), 5) / 10", w: "0.1", h: "at(at(steps, i), 5) / 10", tone: "azure" },
      ],
    },
  },
  readouts: [{ type: "stateBadge", label: "step", value: "i" }],
  controls: {
    type: "controls",
    controls: [{ type: "slider", label: "replay", value: "i", min: 0, max: "k - 1", step: 1, event: "scrub" }],
  },
};

const search: ReactiveSpec = {
  type: "reactive",
  prompt: "Set a **target** that lives in the array (try `9`), run the search, then scrub to watch the window close in.",
  criticalThinking: "Binary search cuts the search space in half each step — how does its speed scale vs. linear search as the array grows?",
  accent: "emerald",
  state: { steps: [[0, 3, 7]], i: 0, k: 1, found: -1 },
  reactions: [
    {
      on: "find",
      when: "event.ok",
      do: [
        { set: "steps", to: "event.out.steps" },
        { set: "k", to: "event.out.k" },
        { set: "found", to: "event.out.found" },
        { set: "i", to: "0" },
      ],
    },
    { on: "scrub", allowSequentialWrite: true, do: [{ set: "i", to: "clamp(event.value, 0, k - 1)" }] },
  ],
  evaluator: { ok: "found >= 0", msgOk: "Target located." },
  evaluatePolicy: { onEvent: true, onSubmit: false },
  code: {
    type: "codeProbe",
    language: "javascript",
    harness: { id: "js-real-execution" },
    editMode: "holes",
    runMode: "manualRun",
    event: "find",
    source: [
      { kind: "locked", id: "l1", text: "const arr = [1, 3, 4, 7, 9, 11, 15, 20];\nconst target = " },
      { kind: "blankHole", id: "t", placeholder: "9", maxChars: 3 },
      {
        kind: "locked",
        id: "l2",
        text:
          ";\n" +
          "let lo = 0, hi = arr.length - 1, found = -1;\n" +
          "const steps = [];\n" +
          "while (lo <= hi) {\n" +
          "  const mid = Math.floor((lo + hi) / 2);\n" +
          "  steps.push([lo, mid, hi]);\n" +
          "  if (arr[mid] === target) { found = mid; break; }\n" +
          "  if (arr[mid] < target) lo = mid + 1;\n" +
          "  else hi = mid - 1;\n" +
          "}\n" +
          'result("steps", steps);\n' +
          'result("k", steps.length);\n' +
          'result("found", found);',
      },
    ],
  },
  stage: {
    type: "diagramScene",
    scene: {
      coordinateSystem: "unit",
      width: 100,
      height: 100,
      shapes: [
        {
          type: "rect",
          x: "at(at(steps, i), 0) * 0.11 + 0.05",
          y: "0.40",
          w: "(at(at(steps, i), 2) - at(at(steps, i), 0) + 1) * 0.11",
          h: "0.18",
          tone: "emerald",
        },
        { type: "circle", cx: "at(at(steps, i), 1) * 0.11 + 0.105", cy: "0.49", r: "0.035", tone: "amber" },
        { type: "label", at: { x: "0.105", y: "0.51" }, text: "1" },
        { type: "label", at: { x: "0.215", y: "0.51" }, text: "3" },
        { type: "label", at: { x: "0.325", y: "0.51" }, text: "4" },
        { type: "label", at: { x: "0.435", y: "0.51" }, text: "7" },
        { type: "label", at: { x: "0.545", y: "0.51" }, text: "9" },
        { type: "label", at: { x: "0.655", y: "0.51" }, text: "11" },
        { type: "label", at: { x: "0.765", y: "0.51" }, text: "15" },
        { type: "label", at: { x: "0.875", y: "0.51" }, text: "20" },
      ],
    },
  },
  readouts: [{ type: "stateBadge", label: "result", value: 'if(found >= 0, concat("index ", found), "not found")' }],
  controls: {
    type: "controls",
    controls: [{ type: "slider", label: "replay", value: "i", min: 0, max: "k - 1", step: 1, event: "scrub" }],
  },
};

/* ── v4 observation slice ────────────────────────────────────────────
   The real harness emits a typed *observation* per enter/exit. The player
   replays them as `obs:<kind>` events; reactions fold each into the live
   stack; the evaluator asserts the **observation pattern** (not the source
   text). The viz primitives are structural — `sequence` reads the folded
   array, never coordinates. This is the end-to-end "Foundation + 1 slice". */
const recursionObs: ReactiveSpec = {
  type: "reactive",
  prompt: "Fix the **base case** so `fact(5)` returns **120**, then play the recording to watch the call stack push and pop.",
  criticalThinking: "The observation stream records what *happened*, not just the final state — why does recording the sequence matter more than the code text?",
  accent: "violet",
  state: { obs: [], runId: 0, stack: [] },
  reactions: [
    {
      on: "ran",
      do: [
        { set: "obs", to: "event.observations" },
        { set: "stack", to: "[]" },
        { set: "runId", to: "runId + 1" },
      ],
    },
    {
      on: "obs:enter",
      allowSequentialWrite: true,
      do: [{ set: "stack", to: 'push(stack, concat("fact(", at(event.args, 0), ")"))' }],
    },
    { on: "obs:exit", allowSequentialWrite: true, do: [{ set: "stack", to: "removeLast(stack)" }] },
    { on: "play:reset", allowSequentialWrite: true, do: [{ set: "stack", to: "[]" }] },
  ],
  evaluator: {
    ok: 'obsContains(obs, "exit", "value", 120) && obsCount(obs, "enter") == 5',
    msgOk: "fact(5) = 120 — five frames in, five frames out.",
    msgNo: "Set the base case so the recursion bottoms out at 1.",
  },
  evaluatePolicy: { onEvent: true, onSubmit: false },
  code: {
    type: "codeProbe",
    language: "javascript",
    harness: { id: "js-observation" },
    editMode: "holes",
    runMode: "manualRun",
    event: "ran",
    source: [
      {
        kind: "locked",
        id: "l1",
        text:
          "function fact(n) {\n" +
          '  enter("fact", n);\n' +
          "  if (n <= 1) {\n" +
          "    const b = ",
      },
      { kind: "blankHole", id: "base", placeholder: "1", maxChars: 4 },
      {
        kind: "locked",
        id: "l2",
        text:
          ";\n" +
          '    exit("fact", b);\n' +
          "    return b;\n" +
          "  }\n" +
          "  const r = n * fact(n - 1);\n" +
          '  exit("fact", r);\n' +
          "  return r;\n" +
          "}\n" +
          "fact(5);",
      },
    ],
  },
  stage: { type: "sequence", items: "stack", cursor: "len(stack) - 1", label: "call stack", orientation: "stack" },
  readouts: [{ type: "stateBadge", label: "depth", value: "len(stack)" }],
  player: {
    type: "observationPlayer",
    source: "obs",
    version: "runId",
    label: "replay",
    playback: { mode: "auto", fps: 2 },
  },
};

/* Full free-text IDE: the learner writes real code in a multi-line editor with
   live syntax highlight + symbol autocomplete (type `en`, Tab). The observation
   harness records each enter/exit; the player replays them. */
const freeEditor: ReactiveSpec = {
  type: "reactive",
  prompt: "Write `fact(n)` so it records each call. Use `enter(name, …args)` and `exit(name, value)` — type `en` and press Tab.",
  criticalThinking: "The IDE autocompletes from the harness symbol table — why does the tool know what symbols are available?",
  accent: "azure",
  state: { obs: [], runId: 0 },
  reactions: [
    {
      on: "ran",
      do: [
        { set: "obs", to: "event.observations" },
        { set: "runId", to: "runId + 1" },
      ],
    },
  ],
  evaluator: { ok: 'obsCount(obs, "enter") >= 3', msgOk: "Calls recorded.", msgNo: "Record at least three calls with enter()." },
  evaluatePolicy: { onEvent: true, onSubmit: false },
  code: {
    type: "codeProbe",
    language: "javascript",
    harness: { id: "js-observation" },
    editMode: "multiRegionFreeText",
    runMode: "manualRun",
    event: "ran",
    source: [
      {
        kind: "editableText",
        id: "code",
        maxChars: 2000,
        initial:
          "function fact(n) {\n" +
          '  enter("fact", n);\n' +
          "  if (n <= 1) {\n" +
          '    exit("fact", 1);\n' +
          "    return 1;\n" +
          "  }\n" +
          "  const r = n * fact(n - 1);\n" +
          '  exit("fact", r);\n' +
          "  return r;\n" +
          "}\n" +
          "fact(4);",
      },
    ],
  },
  stage: { type: "numberLine", value: "0", min: 0, max: 1 },
  player: { type: "observationPlayer", source: "obs", version: "runId", label: "replay", playback: { mode: "auto", fps: 3 } },
};

/* ── Flagship: the C++ std::pmr arena, built the domain-agnostic way ──
   A monotonic_buffer_resource bumps a pointer and NEVER frees. A doubling
   vector reallocates; each dead block lingers, so the buffer fills with
   garbage and the live data spills to the heap. The learner edits real JS
   (autocomplete-backed) that calls the generic `alloc(id, size, region)`
   probe; each observation folds into the `arena` model, which owns every
   coordinate and draws the escape arrow when the heap fills. */
const pmrArena: ReactiveSpec = {
  type: "reactive",
  accent: "azure",
  prompt:
    "This JS models a `std::pmr::monotonic_buffer_resource` of **128 B** — it bumps a pointer and **never frees**. The doubling vector spills to the heap. **Hold all 128 B in the buffer with no heap spill.**",
  hook: "Same primitive, any domain: declare regions + sized blocks; the **arena** packs them, draws the capacity gauge, and routes the overflow arrow. You never write a coordinate.",
  state: { obs: [], blocks: [], bufUsed: 0, heapCount: 0, runId: 0 },
  reactions: [
    {
      on: "ran",
      do: [
        { set: "obs", to: "event.observations" },
        { set: "blocks", to: "[]" },
        { set: "bufUsed", to: "0" },
        { set: "heapCount", to: "0" },
        { set: "runId", to: "runId + 1" },
      ],
    },
    {
      on: "obs:alloc",
      when: 'event.region == "buf"',
      allowSequentialWrite: true,
      do: [
        {
          set: "blocks",
          to: 'push(blocks, record("id", event.id, "size", event.size, "region", event.region, "label", event.label))',
        },
        { set: "bufUsed", to: "bufUsed + event.size" },
      ],
    },
    {
      on: "obs:alloc",
      when: 'event.region == "heap"',
      allowSequentialWrite: true,
      do: [
        {
          set: "blocks",
          to: 'push(blocks, record("id", event.id, "size", event.size, "region", event.region, "label", event.label))',
        },
        { set: "heapCount", to: "heapCount + 1" },
      ],
    },
    {
      on: "play:reset",
      allowSequentialWrite: true,
      do: [
        { set: "blocks", to: "[]" },
        { set: "bufUsed", to: "0" },
        { set: "heapCount", to: "0" },
      ],
    },
  ],
  evaluator: {
    ok: "heapCount == 0 && bufUsed >= 128",
    msgOk: "No spill — the live data sits entirely in the buffer. Reserve once, churn never.",
    msgNo: "Something escaped to the heap. Doubling reallocations leave dead blocks the monotonic buffer can't reclaim — reserve the final size up front.",
    proximity: "1 - heapCount / 4",
  },
  evaluatePolicy: { onEvent: true, onSubmit: false },
  criticalThinking:
    "A monotonic buffer never reclaims, yet it's often *faster* than a general allocator. When is 'waste memory, never free' the right trade — and when would it bite you?",
  code: {
    type: "codeProbe",
    language: "javascript",
    harness: { id: "js-observation" },
    editMode: "multiRegionFreeText",
    runMode: "manualRun",
    event: "ran",
    source: [
      {
        kind: "locked",
        id: "alloc",
        text:
          "// monotonic_buffer_resource: bump a pointer, NEVER free.\n" +
          "const CAP = 128;\n" +
          "let used = 0;\n" +
          "function reserve(name, bytes) {\n" +
          "  if (used + bytes <= CAP) {\n" +
          "    used += bytes;\n" +
          '    alloc(name, bytes, "buf", name);\n' +
          "  } else {\n" +
          '    alloc(name, bytes, "heap", name);\n' +
          "  }\n" +
          "}\n",
      },
      {
        kind: "editableText",
        id: "body",
        maxChars: 1200,
        initial:
          "// std::pmr::vector<int> growing by doubling.\n" +
          "// Every growth reallocates; the old block is never reclaimed.\n" +
          'reserve("cap=2", 8);\n' +
          'reserve("cap=4", 16);\n' +
          'reserve("cap=8", 32);\n' +
          'reserve("cap=16", 64);\n' +
          'reserve("cap=32", 128);\n',
      },
    ],
  },
  stage: {
    type: "arena",
    label: "std::pmr::monotonic_buffer_resource",
    regions: [
      { id: "buf", label: "buffer", capacity: 128, unit: "B", tone: "azure" },
      { id: "heap", label: "system heap", unit: "B", tone: "no" },
    ],
    blocks: "blocks",
    overflow: { from: "buf", to: "heap", label: "overflow" },
  },
  readouts: [{ type: "stateBadge", label: "buffer used", value: 'concat(bufUsed, " / 128 B")' }],
  player: { type: "observationPlayer", source: "obs", version: "runId", label: "allocations", playback: { mode: "auto", fps: 2 } },
};

const costCurve: ReactiveSpec = {
  type: "reactive",
  accent: "violet",
  prompt:
    "Each run charges `cost(n)` operations for inputs **n = 1…8**, plotting one point per n. The dashed line is your **time budget (48 ops)**. **Keep every point on or under the budget** — pick a complexity that scales.",
  hook: "Declare a data model (`[n, cost]` points); the **plot** auto-fits the axes, picks tick steps, and draws your curve, the budget ghost, and the worst-case cursor. You never place a pixel.",
  state: { obs: [], samples: [], peak: 0, budget: [[1, 48], [8, 48]], runId: 0 },
  reactions: [
    {
      on: "ran",
      do: [
        { set: "obs", to: "event.observations" },
        { set: "samples", to: "[]" },
        { set: "peak", to: "0" },
        { set: "runId", to: "runId + 1" },
      ],
    },
    {
      on: "obs:point",
      allowSequentialWrite: true,
      do: [
        { set: "samples", to: 'push(samples, record("x", event.x, "y", event.y))' },
        { set: "peak", to: "max(peak, event.y)" },
      ],
    },
    {
      on: "play:reset",
      allowSequentialWrite: true,
      do: [
        { set: "samples", to: "[]" },
        { set: "peak", to: "0" },
      ],
    },
  ],
  evaluator: {
    ok: "len(samples) >= 8 && peak <= 48",
    msgOk: "Every point sits under the budget — this complexity scales.",
    msgNo: "Some n blows the budget. A quadratic cost (n*n) explodes as n grows; choose a cost that grows linearly or slower.",
    proximity: "1 - clamp((peak - 48) / 64, 0, 1)",
  },
  evaluatePolicy: { onEvent: true, onSubmit: false },
  criticalThinking:
    "Your cost fits at n ≤ 8. Roughly what's the largest n the same 48-op budget allows for n*n versus 6n — and which curve would you bet on at n = 1000?",
  code: {
    type: "codeProbe",
    language: "javascript",
    harness: { id: "js-observation" },
    editMode: "multiRegionFreeText",
    runMode: "manualRun",
    event: "ran",
    source: [
      {
        kind: "locked",
        id: "head",
        text:
          "// We charge cost(n) operations for n = 1..8 and plot each point.\n" +
          "// The dashed budget line sits at 48 ops — stay on or under it.\n",
      },
      {
        kind: "editableText",
        id: "cost",
        maxChars: 400,
        initial:
          "function cost(n) {\n" +
          "  // How many ops does your algorithm do for input n?\n" +
          "  return n * n; // quadratic — try a cheaper growth\n" +
          "}\n",
      },
      {
        kind: "locked",
        id: "runner",
        text: "\nfor (let n = 1; n <= 8; n++) {\n" + '  emit("point", { x: n, y: cost(n) });\n' + "}\n",
      },
    ],
  },
  stage: {
    type: "plot",
    label: "cost(n) vs budget",
    x: { label: "input n", min: 0, max: 8 },
    y: { label: "operations", min: 0 },
    series: [{ id: "cost", points: "samples", style: "area", tone: "violet", label: "your cost" }],
    target: { id: "budget", points: "budget", style: "line", tone: "no", label: "budget" },
    cursor: { x: "8", y: "peak", label: "peak", tone: "no" },
  },
  readouts: [{ type: "stateBadge", label: "peak cost", value: 'concat(peak, " ops")' }],
  player: { type: "observationPlayer", source: "obs", version: "runId", label: "samples", playback: { mode: "auto", fps: 4 } },
};

const recursionGraph: ReactiveSpec = {
  type: "reactive",
  accent: "emerald",
  prompt:
    "Fix the **base case** so `fact(5)` returns **120**, then replay the run: each call grows the tree, and every frame turns **green the moment it returns**.",
  hook: "Declare nodes + edges; the **graph** ranks the call tree and routes the arrows. `setField` re-tones a node when its frame exits — the unwind becomes a visible cascade.",
  state: { obs: [], nodes: [], edges: [], result: 0, runId: 0 },
  reactions: [
    {
      on: "ran",
      do: [
        { set: "obs", to: "event.observations" },
        { set: "nodes", to: "[]" },
        { set: "edges", to: "[]" },
        { set: "result", to: "0" },
        { set: "runId", to: "runId + 1" },
      ],
    },
    {
      on: "obs:enter",
      allowSequentialWrite: true,
      do: [
        {
          set: "nodes",
          to: 'push(nodes, record("id", concat("f", event.depth), "label", concat("fact(", at(event.args, 0), ")"), "tone", "muted"))',
        },
      ],
    },
    {
      on: "obs:enter",
      when: "event.depth > 1",
      allowSequentialWrite: true,
      do: [
        {
          set: "edges",
          to: 'push(edges, record("from", concat("f", event.depth - 1), "to", concat("f", event.depth)))',
        },
      ],
    },
    {
      on: "obs:exit",
      allowSequentialWrite: true,
      do: [{ set: "nodes", to: 'setField(nodes, event.depth - 1, "tone", "ok")' }],
    },
    {
      on: "obs:exit",
      when: "event.depth == 1",
      allowSequentialWrite: true,
      do: [{ set: "result", to: "event.value" }],
    },
    {
      on: "play:reset",
      allowSequentialWrite: true,
      do: [
        { set: "nodes", to: "[]" },
        { set: "edges", to: "[]" },
        { set: "result", to: "0" },
      ],
    },
  ],
  evaluator: {
    ok: "result == 120 && len(nodes) == 5",
    msgOk: "fact(5) = 120 — five frames opened, five returned.",
    msgNo: "The tree built, but the value flowing back up is wrong. Make the recursion bottom out at 1.",
    proximity: "len(nodes) / 5",
  },
  evaluatePolicy: { onEvent: true, onSubmit: false },
  criticalThinking:
    "Every frame here waits on the one below it. Sketch the tree `fib(5)` would build — what changes in its *shape*, and why does memoization collapse it?",
  code: {
    type: "codeProbe",
    language: "javascript",
    harness: { id: "js-observation" },
    editMode: "holes",
    runMode: "manualRun",
    event: "ran",
    source: [
      {
        kind: "locked",
        id: "l1",
        text:
          "function fact(n) {\n" +
          '  enter("fact", n);\n' +
          "  if (n <= 1) {\n" +
          "    const b = ",
      },
      { kind: "blankHole", id: "base", placeholder: "1", maxChars: 4 },
      {
        kind: "locked",
        id: "l2",
        text:
          ";\n" +
          '    exit("fact", b);\n' +
          "    return b;\n" +
          "  }\n" +
          "  const r = n * fact(n - 1);\n" +
          '  exit("fact", r);\n' +
          "  return r;\n" +
          "}\n" +
          "fact(5);",
      },
    ],
  },
  stage: { type: "graph", label: "call tree", nodes: "nodes", edges: "edges", layout: "tree", directed: true },
  readouts: [{ type: "stateBadge", label: "fact(5)", value: "result" }],
  player: { type: "observationPlayer", source: "obs", version: "runId", label: "replay", playback: { mode: "auto", fps: 2 } },
};

export const PRESETS: Preset[] = [
  { id: "counter", label: "Counter", spec: counter },
  { id: "tape", label: "Turing tape", spec: tape },
  { id: "orbit", label: "Tick + scene", spec: orbit },
  { id: "probe", label: "Code probe", spec: probe },
  { id: "plot", label: "Functions → curve", spec: plot },
  { id: "recursion", label: "Recursion → stack", spec: recursion },
  { id: "recursion-obs", label: "Recursion (observed)", spec: recursionObs },
  { id: "free-editor", label: "Free editor (IDE)", spec: freeEditor },
  { id: "pmr-arena", label: "pmr arena → spill", spec: pmrArena },
  { id: "cost-curve", label: "Cost curve → budget", spec: costCurve },
  { id: "recursion-graph", label: "Recursion → call tree", spec: recursionGraph },
  { id: "sorting", label: "Sorting → bars", spec: sorting },
  { id: "search", label: "Binary search", spec: search },
];
