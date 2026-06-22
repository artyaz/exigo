/* ═══════════════════════════════════════════════════════════════════
   EXIGO AAP — Closed runtime helpers.
   The ONLY way a spec gets dynamic collection/grid behaviour. No
   user-defined callbacks, no lambdas, no raw loops in author space —
   the loops live here, in tested, capped code.
   ═══════════════════════════════════════════════════════════════════ */
import type { Value } from "./types";
import { ExprError, toDisplay } from "./expr";

export const CAPS = {
  MAX_ARRAY: 256,
  MAX_GRID_CELLS: 400,
  MAX_MATRIX_DIM: 8,
} as const;

type Helper = (args: Value[]) => Value;

const num = (v: Value, where: string): number => {
  if (typeof v !== "number") throw new ExprError(`${where}: expected number, got ${typeof v}.`);
  return v;
};
const arr = (v: Value, where: string): Value[] => {
  if (!Array.isArray(v)) throw new ExprError(`${where}: expected array.`);
  return v;
};
const grid = (v: Value, where: string): number[][] => {
  if (!Array.isArray(v) || !v.every((r) => Array.isArray(r))) throw new ExprError(`${where}: expected a 2D grid.`);
  const g = v as Value[][];
  let cells = 0;
  for (const row of g) cells += row.length;
  if (cells > CAPS.MAX_GRID_CELLS) throw new ExprError(`${where}: grid exceeds ${CAPS.MAX_GRID_CELLS} cells.`);
  return g.map((row) => row.map((c) => num(c, where)));
};
const intArg = (v: Value, where: string): number => {
  const n = num(v, where);
  if (!Number.isInteger(n)) throw new ExprError(`${where}: expected integer.`);
  return n;
};
/** Coerce an array of observation records; non-object items become `{}`. */
const obsList = (v: Value, where: string): Record<string, Value>[] => {
  if (!Array.isArray(v)) throw new ExprError(`${where}: expected an observation array.`);
  return v.map((it) => (it && typeof it === "object" && !Array.isArray(it) ? (it as Record<string, Value>) : {}));
};

const clone2d = (g: number[][]): number[][] => g.map((r) => r.slice());

export const HELPERS: Record<string, Helper> = {
  /* ── scalar math ── */
  min: (a) => Math.min(...a.map((v) => num(v, "min"))),
  max: (a) => Math.max(...a.map((v) => num(v, "max"))),
  abs: (a) => Math.abs(num(a[0]!, "abs")),
  floor: (a) => Math.floor(num(a[0]!, "floor")),
  ceil: (a) => Math.ceil(num(a[0]!, "ceil")),
  round: (a) => Math.round(num(a[0]!, "round")),
  sign: (a) => Math.sign(num(a[0]!, "sign")),
  clamp: (a) => {
    const [x, lo, hi] = [num(a[0]!, "clamp"), num(a[1]!, "clamp"), num(a[2]!, "clamp")];
    return Math.max(lo, Math.min(hi, x));
  },
  mod: (a) => {
    const d = num(a[1]!, "mod");
    if (d === 0) throw new ExprError("mod: division by zero.");
    return ((num(a[0]!, "mod") % d) + d) % d;
  },

  /* ── strings ── */
  len: (a) => {
    const v = a[0]!;
    if (typeof v === "string" || Array.isArray(v)) return v.length;
    throw new ExprError("len: expected string or array.");
  },
  concat: (a) => a.map(toDisplay).join(""),
  upper: (a) => String(a[0] as string).toUpperCase(),
  lower: (a) => String(a[0] as string).toLowerCase(),

  /* ── arrays ── */
  range: (a) => {
    const n = intArg(a[0]!, "range");
    if (n < 0 || n > CAPS.MAX_ARRAY) throw new ExprError(`range: 0..${CAPS.MAX_ARRAY}.`);
    return Array.from({ length: n }, (_, i) => i);
  },
  at: (a) => {
    const list = arr(a[0]!, "at");
    const i = intArg(a[1]!, "at");
    return i >= 0 && i < list.length ? list[i]! : null;
  },
  setAt: (a) => {
    const list = arr(a[0]!, "setAt").slice();
    const i = intArg(a[1]!, "setAt");
    if (i < 0 || i >= list.length) throw new ExprError("setAt: index out of range.");
    list[i] = a[2]!;
    return list;
  },
  push: (a) => {
    const list = arr(a[0]!, "push").slice();
    if (list.length >= CAPS.MAX_ARRAY) throw new ExprError(`push: array exceeds ${CAPS.MAX_ARRAY}.`);
    list.push(a[1]!);
    return list;
  },
  swap: (a) => {
    const list = arr(a[0]!, "swap").slice();
    const i = intArg(a[1]!, "swap");
    const j = intArg(a[2]!, "swap");
    if (i < 0 || j < 0 || i >= list.length || j >= list.length) throw new ExprError("swap: index out of range.");
    [list[i], list[j]] = [list[j]!, list[i]!];
    return list;
  },
  sum: (a) => arr(a[0]!, "sum").reduce<number>((s, v) => s + num(v, "sum"), 0),
  count: (a) => {
    const list = arr(a[0]!, "count");
    const target = a[1]!;
    return list.filter((v) => v === target).length;
  },
  // Count rows (records) where row[key] === value. The natural "how many items
  // are in bucket X" / "how many answered Y" for classification exercises.
  countWhere: (a) => {
    const list = arr(a[0]!, "countWhere");
    const key = String(a[1] as string | number);
    const value = a[2]!;
    return list.filter((r) => r != null && typeof r === "object" && !Array.isArray(r) && (r as Record<string, unknown>)[key] === value).length;
  },
  // Count rows where two of their fields match — e.g. countMatch(items,
  // "placed", "correct") scores a classification without a fold.
  countMatch: (a) => {
    const list = arr(a[0]!, "countMatch");
    const keyA = String(a[1] as string | number);
    const keyB = String(a[2] as string | number);
    return list.filter((r) => {
      if (r == null || typeof r !== "object" || Array.isArray(r)) return false;
      const rec = r as Record<string, unknown>;
      return rec[keyA] === rec[keyB];
    }).length;
  },
  /** Drop the last element (the closed counterpart to `push` — a stack pop). */
  removeLast: (a) => {
    const list = arr(a[0]!, "removeLast");
    return list.slice(0, Math.max(0, list.length - 1));
  },
  /** Build a record from alternating key/value args: `record("id", x, "n", 3)`.
     The DSL has no object literal, so this is the ONE way author space
     synthesises a typed record — the obs→model fold that feeds the semantic
     viz primitives (arena, plot, graph) their `{ id, region, size, … }` rows
     straight from observation fields, without a lambda or a coordinate. */
  record: (a) => {
    if (a.length % 2 !== 0) throw new ExprError("record: expects alternating key, value pairs.");
    const out: Record<string, Value> = {};
    for (let i = 0; i < a.length; i += 2) {
      const k = a[i]!;
      if (typeof k !== "string") throw new ExprError("record: keys must be strings.");
      out[k] = a[i + 1]!;
    }
    return out;
  },
  /** Copy of `list` with `list[i]`'s field `key` set — `record`'s update
     counterpart, so a fold can revise an earlier row (e.g. re-tone a call
     node when its frame returns): `setField(nodes, 2, "tone", "ok")`. */
  setField: (a) => {
    const list = arr(a[0]!, "setField").slice();
    const i = intArg(a[1]!, "setField");
    const key = a[2]!;
    if (typeof key !== "string") throw new ExprError("setField: key must be a string.");
    if (i < 0 || i >= list.length) throw new ExprError("setField: index out of range.");
    const it = list[i];
    if (!it || typeof it !== "object" || Array.isArray(it)) throw new ExprError("setField: list[i] must be a record.");
    list[i] = { ...(it as Record<string, Value>), [key]: a[3] ?? null };
    return list;
  },

  /* ── observations (v4) ──────────────────────────────────────────
     Closed queries over an observation stream so the evaluator can assert
     *behaviour* (a pattern of what the program did) without lambdas and
     without ever string-matching source. Items are observation records;
     `.kind` selects them. Scalar comparison is strict (`===`). */
  obsCount: (a) => {
    const list = obsList(a[0]!, "obsCount");
    const kind = String(a[1] as string | number);
    return list.filter((o) => o.kind === kind).length;
  },
  obsContains: (a) => {
    const list = obsList(a[0]!, "obsContains");
    const kind = String(a[1] as string | number);
    const field = String(a[2] as string | number);
    const value = a[3] ?? null;
    return list.some((o) => o.kind === kind && o[field] === value);
  },
  /** True iff `kinds` appears as a contiguous run in the stream's kinds. */
  obsSeq: (a) => {
    const list = obsList(a[0]!, "obsSeq");
    const pat = arr(a[1]!, "obsSeq").map((v) => String(v as string | number));
    if (pat.length === 0) return true;
    const kinds = list.map((o) => String(o.kind as string | number));
    for (let i = 0; i + pat.length <= kinds.length; i++) {
      let hit = true;
      for (let j = 0; j < pat.length; j++) {
        if (kinds[i + j] !== pat[j]) {
          hit = false;
          break;
        }
      }
      if (hit) return true;
    }
    return false;
  },
  /** One Bubble-sort comparison/swap pass index `step`. mode: "asc"|"desc". */
  sortStep: (a) => {
    const list = arr(a[0]!, "sortStep").map((v) => num(v, "sortStep"));
    const mode = (a[1] as string) ?? "asc";
    const out = list.slice();
    let swapped = false;
    for (let i = 0; i + 1 < out.length; i++) {
      const cmp = mode === "desc" ? out[i]! < out[i + 1]! : out[i]! > out[i + 1]!;
      if (cmp && !swapped) {
        [out[i], out[i + 1]] = [out[i + 1]!, out[i]!];
        swapped = true;
        break;
      }
    }
    return out;
  },

  /* ── grids / matrices ── */
  gridGet: (a) => {
    const g = grid(a[0]!, "gridGet");
    const r = intArg(a[1]!, "gridGet");
    const c = intArg(a[2]!, "gridGet");
    return g[r]?.[c] ?? null;
  },
  gridSet: (a) => {
    const g = clone2d(grid(a[0]!, "gridSet"));
    const r = intArg(a[1]!, "gridSet");
    const c = intArg(a[2]!, "gridSet");
    const v = num(a[3]!, "gridSet");
    if (!g[r] || c < 0 || c >= g[r].length) throw new ExprError("gridSet: out of range.");
    g[r][c] = v;
    return g;
  },
  transpose: (a) => {
    const g = grid(a[0]!, "transpose");
    const rows = g.length;
    const cols = g[0]?.length ?? 0;
    if (g.some((r) => r.length !== cols)) throw new ExprError("transpose: ragged matrix.");
    return Array.from({ length: cols }, (_, c) => Array.from({ length: rows }, (_, r) => g[r]![c]!));
  },
  matmul2: (a) => {
    const x = grid(a[0]!, "matmul2");
    const y = grid(a[1]!, "matmul2");
    const n = x.length;
    const m = y[0]?.length ?? 0;
    const k = y.length;
    if (n > CAPS.MAX_MATRIX_DIM || m > CAPS.MAX_MATRIX_DIM || k > CAPS.MAX_MATRIX_DIM)
      throw new ExprError(`matmul2: max ${CAPS.MAX_MATRIX_DIM}x${CAPS.MAX_MATRIX_DIM}.`);
    if (x.some((r) => r.length !== k)) throw new ExprError("matmul2: incompatible dimensions.");
    return Array.from({ length: n }, (_, i) =>
      Array.from({ length: m }, (_, j) => {
        let s = 0;
        for (let t = 0; t < k; t++) s += x[i]![t]! * y[t]![j]!;
        return s;
      }),
    );
  },
  countNeighbors2d: (a) => {
    const g = grid(a[0]!, "countNeighbors2d");
    const r = intArg(a[1]!, "countNeighbors2d");
    const c = intArg(a[2]!, "countNeighbors2d");
    const target = num(a[3]!, "countNeighbors2d");
    let count = 0;
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        if (g[r + dr]?.[c + dc] === target) count++;
      }
    return count;
  },
  /** One Conway-style step. birth/survive are arrays of neighbour counts. */
  stepLife: (a) => {
    const g = grid(a[0]!, "stepLife");
    const birth = arr(a[1]!, "stepLife").map((v) => num(v, "stepLife"));
    const survive = arr(a[2]!, "stepLife").map((v) => num(v, "stepLife"));
    return g.map((row, r) =>
      row.map((cell, c) => {
        let live = 0;
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            if (g[r + dr]?.[c + dc] === 1) live++;
          }
        if (cell === 1) return survive.includes(live) ? 1 : 0;
        return birth.includes(live) ? 1 : 0;
      }),
    );
  },
};

export const HELPER_NAMES = new Set([...Object.keys(HELPERS), "if"]);
