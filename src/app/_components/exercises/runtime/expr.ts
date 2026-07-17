/* ═══════════════════════════════════════════════════════════════════
   EXIGO AAP — Expression DSL.
   A tiny, pure, side-effect-free expression language. It is deliberately
   NOT a programming language: no function definitions, no lambdas, no
   assignment, no loops. Dynamic behaviour comes from closed named
   helpers (see ./helpers.ts), never from author-supplied callbacks.

   This module exposes:
     parse(src)      → Ast            (throws ExprError on syntax/lambda)
     compile(src)    → CompiledExpr   (ast + static refs/calls)
     evaluate(ast,…) → Value
   ═══════════════════════════════════════════════════════════════════ */
import type { Value } from "./types";
import { HELPERS } from "./helpers";

export class ExprError extends Error {}

/* ── AST ─────────────────────────────────────────────────────────── */
export type Ast =
  | { k: "lit"; v: Value }
  | { k: "array"; items: Ast[] }
  | { k: "ident"; name: string }
  | { k: "member"; obj: Ast; prop: string }
  | { k: "index"; obj: Ast; index: Ast }
  | { k: "call"; name: string; args: Ast[] }
  | { k: "unary"; op: string; arg: Ast }
  | { k: "binary"; op: string; left: Ast; right: Ast }
  | { k: "logical"; op: "&&" | "||"; left: Ast; right: Ast };

/* ── Tokenizer ───────────────────────────────────────────────────── */
type Tok =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "id"; v: string }
  | { t: "punc"; v: string };

const KEYWORD_LIT: Record<string, Value> = {
  true: true,
  false: false,
  null: null,
};

function lex(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const n = src.length;
  const multi = ["===", "!==", "&&", "||", "==", "!=", "<=", ">=", "=>"];
  while (i < n) {
    const ch = src[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    // number
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      let j = i + 1;
      while (j < n && /[0-9._eE+-]/.test(src[j]!)) {
        // stop a trailing +/- that is not part of an exponent
        if ((src[j] === "+" || src[j] === "-") && !/[eE]/.test(src[j - 1]!)) break;
        j++;
      }
      const raw = src.slice(i, j).replace(/_/g, "");
      const v = Number(raw);
      if (Number.isNaN(v)) throw new ExprError(`Invalid number: "${raw}"`);
      toks.push({ t: "num", v });
      i = j;
      continue;
    }
    // string
    if (ch === '"' || ch === "'" || ch === "`") {
      let j = i + 1;
      let out = "";
      while (j < n && src[j] !== ch) {
        if (src[j] === "\\") {
          const next = src[j + 1] ?? "";
          out += next === "n" ? "\n" : next === "t" ? "\t" : next;
          j += 2;
          continue;
        }
        out += src[j];
        j++;
      }
      if (j >= n) throw new ExprError("Unterminated string literal.");
      toks.push({ t: "str", v: out });
      i = j + 1;
      continue;
    }
    // identifier / keyword
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_$]/.test(src[j]!)) j++;
      toks.push({ t: "id", v: src.slice(i, j) });
      i = j;
      continue;
    }
    // multi-char punctuation
    const three = src.slice(i, i + 3);
    const two = src.slice(i, i + 2);
    if (multi.includes(three)) {
      toks.push({ t: "punc", v: three });
      i += 3;
      continue;
    }
    if (multi.includes(two)) {
      toks.push({ t: "punc", v: two });
      i += 2;
      continue;
    }
    if ("+-*/%<>!()[].,?:".includes(ch)) {
      toks.push({ t: "punc", v: ch });
      i++;
      continue;
    }
    if (ch === "=") throw new ExprError("Assignment `=` is not allowed in expressions.");
    throw new ExprError(`Unexpected character: "${ch}"`);
  }
  return toks;
}

/* ── Parser (recursive descent) ──────────────────────────────────── */
class Parser {
  private p = 0;
  constructor(private toks: Tok[]) {}

  private peek(): Tok | undefined {
    return this.toks[this.p];
  }
  private next(): Tok | undefined {
    return this.toks[this.p++];
  }
  private isPunc(v: string): boolean {
    const t = this.peek();
    return !!t && t.t === "punc" && t.v === v;
  }
  private eat(v: string): void {
    if (!this.isPunc(v)) throw new ExprError(`Expected "${v}".`);
    this.p++;
  }

  parse(): Ast {
    const ast = this.parseOr();
    if (this.p < this.toks.length) {
      const t = this.peek()!;
      throw new ExprError(`Unexpected token "${t.v}".`);
    }
    return ast;
  }

  private parseOr(): Ast {
    let left = this.parseAnd();
    while (this.isPunc("||")) {
      this.p++;
      left = { k: "logical", op: "||", left, right: this.parseAnd() };
    }
    return left;
  }
  private parseAnd(): Ast {
    let left = this.parseEquality();
    while (this.isPunc("&&")) {
      this.p++;
      left = { k: "logical", op: "&&", left, right: this.parseEquality() };
    }
    return left;
  }
  private parseEquality(): Ast {
    let left = this.parseCompare();
    while (this.isPunc("==") || this.isPunc("!=") || this.isPunc("===") || this.isPunc("!==")) {
      const op = (this.next() as { v: string }).v;
      left = { k: "binary", op, left, right: this.parseCompare() };
    }
    return left;
  }
  private parseCompare(): Ast {
    let left = this.parseAdd();
    while (this.isPunc("<") || this.isPunc(">") || this.isPunc("<=") || this.isPunc(">=")) {
      const op = (this.next() as { v: string }).v;
      left = { k: "binary", op, left, right: this.parseAdd() };
    }
    return left;
  }
  private parseAdd(): Ast {
    let left = this.parseMul();
    while (this.isPunc("+") || this.isPunc("-")) {
      const op = (this.next() as { v: string }).v;
      left = { k: "binary", op, left, right: this.parseMul() };
    }
    return left;
  }
  private parseMul(): Ast {
    let left = this.parseUnary();
    while (this.isPunc("*") || this.isPunc("/") || this.isPunc("%")) {
      const op = (this.next() as { v: string }).v;
      left = { k: "binary", op, left, right: this.parseUnary() };
    }
    return left;
  }
  private parseUnary(): Ast {
    if (this.isPunc("-") || this.isPunc("!")) {
      const op = (this.next() as { v: string }).v;
      return { k: "unary", op, arg: this.parseUnary() };
    }
    return this.parsePostfix();
  }
  private parsePostfix(): Ast {
    let node = this.parsePrimary();
    for (;;) {
      if (this.isPunc(".")) {
        this.p++;
        const t = this.next();
        if (t?.t !== "id") throw new ExprError("Expected property name after `.`.");
        node = { k: "member", obj: node, prop: t.v };
      } else if (this.isPunc("[")) {
        this.p++;
        const index = this.parseOr();
        this.eat("]");
        node = { k: "index", obj: node, index };
      } else {
        break;
      }
    }
    return node;
  }
  private parsePrimary(): Ast {
    const t = this.next();
    if (!t) throw new ExprError("Unexpected end of expression.");
    if (t.t === "num") return { k: "lit", v: t.v };
    if (t.t === "str") return { k: "lit", v: t.v };
    if (t.t === "id") {
      if (t.v in KEYWORD_LIT) return { k: "lit", v: KEYWORD_LIT[t.v]! };
      // function call?
      if (this.isPunc("(")) {
        this.p++;
        const args: Ast[] = [];
        if (!this.isPunc(")")) {
          args.push(this.parseOr());
          while (this.isPunc(",")) {
            this.p++;
            args.push(this.parseOr());
          }
        }
        this.eat(")");
        return { k: "call", name: t.v, args };
      }
      return { k: "ident", name: t.v };
    }
    if (t.t === "punc") {
      if (t.v === "(") {
        const inner = this.parseOr();
        this.eat(")");
        return inner;
      }
      if (t.v === "[") {
        const items: Ast[] = [];
        if (!this.isPunc("]")) {
          items.push(this.parseOr());
          while (this.isPunc(",")) {
            this.p++;
            items.push(this.parseOr());
          }
        }
        this.eat("]");
        return { k: "array", items };
      }
      if (t.v === "=>") throw new ExprError("Lambda expressions are not supported. Use a closed helper or a template.");
    }
    throw new ExprError(`Unexpected token "${t.v}".`);
  }
}

export function parse(src: string): Ast {
  // hard stop on lambda arrows before tokenising context is lost
  if (src.includes('=>')) throw new ExprError("Lambda expressions are not supported. Use a closed helper or a template.");
  return new Parser(lex(src)).parse();
}

/* ── Static analysis (for the validator) ─────────────────────────── */
export interface CompiledExpr {
  src: string;
  ast: Ast;
  /** Root identifiers referenced (leftmost name of any member/index chain). */
  refs: Set<string>;
  /** Helper functions called. */
  calls: Set<string>;
}

export function compile(src: string): CompiledExpr {
  const ast = parse(src);
  const refs = new Set<string>();
  const calls = new Set<string>();
  const walk = (a: Ast): void => {
    switch (a.k) {
      case "array":
        a.items.forEach(walk);
        break;
      case "ident":
        refs.add(a.name);
        break;
      case "member":
        walk(a.obj);
        break;
      case "index":
        walk(a.obj);
        walk(a.index);
        break;
      case "call":
        calls.add(a.name);
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
  return { src, ast, refs, calls };
}

/* ── Evaluator ───────────────────────────────────────────────────── */
export type Env = Record<string, Value>;

export function truthy(v: Value): boolean {
  return v !== null && v !== false && v !== 0 && v !== "";
}

/** Coerce any runtime value into a human-readable display string. A record
    resolves to its label/name/title/text/id (or a compact join of its scalar
    fields) — NEVER the "[object Object]" leak that appears when an exercise
    concatenates a node/edge object straight into a readout. Shared by `concat`,
    string `+`, and every Display projection so the leak can't reappear in one
    overlooked path. */
export function toDisplay(v: Value): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(toDisplay).join(", ");
  if (typeof v === "object") {
    const o = v as Record<string, Value>;
    for (const k of ["label", "name", "title", "text", "id"]) {
      const f = o[k];
      if (typeof f === "string" || typeof f === "number") return String(f);
    }
    const parts = Object.values(o)
      .filter((x) => typeof x === "string" || typeof x === "number")
      .map(String);
    return parts.join(" · ");
  }
  return String(v);
}

function asNum(v: Value, op: string): number {
  if (typeof v !== "number") throw new ExprError(`Operator "${op}" expects a number, got ${typeof v}.`);
  return v;
}

export function evaluate(ast: Ast, env: Env): Value {
  switch (ast.k) {
    case "lit":
      return ast.v;
    case "array":
      return ast.items.map((it) => evaluate(it, env));
    case "ident": {
      if (!(ast.name in env)) throw new ExprError(`Unknown reference "${ast.name}".`);
      return env[ast.name]!;
    }
    case "member": {
      const obj = evaluate(ast.obj, env);
      if (Array.isArray(obj)) {
        if (ast.prop === "length") return obj.length;
        return null;
      }
      if (obj && typeof obj === "object") {
        return ast.prop in obj ? obj[ast.prop]! : null;
      }
      return null;
    }
    case "index": {
      const obj = evaluate(ast.obj, env);
      const idx = evaluate(ast.index, env);
      if (Array.isArray(obj)) {
        if (typeof idx !== "number") throw new ExprError("Array index must be a number.");
        return idx >= 0 && idx < obj.length ? obj[idx]! : null;
      }
      if (obj && typeof obj === "object") {
        const key = String(idx as string | number);
        return key in obj ? obj[key]! : null;
      }
      return null;
    }
    case "unary": {
      const v = evaluate(ast.arg, env);
      if (ast.op === "-") return -asNum(v, "-");
      return !truthy(v);
    }
    case "logical": {
      const l = evaluate(ast.left, env);
      if (ast.op === "&&") return truthy(l) ? evaluate(ast.right, env) : l;
      return truthy(l) ? l : evaluate(ast.right, env);
    }
    case "binary": {
      const l = evaluate(ast.left, env);
      const r = evaluate(ast.right, env);
      switch (ast.op) {
        case "==":
        case "===":
          return l === r;
        case "!=":
        case "!==":
          return l !== r;
        case "+":
          if (typeof l === "string" || typeof r === "string") return toDisplay(l) + toDisplay(r);
          return asNum(l, "+") + asNum(r, "+");
        case "-":
          return asNum(l, "-") - asNum(r, "-");
        case "*":
          return asNum(l, "*") * asNum(r, "*");
        case "/": {
          const d = asNum(r, "/");
          if (d === 0) throw new ExprError("Division by zero.");
          return asNum(l, "/") / d;
        }
        case "%": {
          const d = asNum(r, "%");
          if (d === 0) throw new ExprError("Modulo by zero.");
          return asNum(l, "%") % d;
        }
        case "<":
          return asNum(l, "<") < asNum(r, "<");
        case ">":
          return asNum(l, ">") > asNum(r, ">");
        case "<=":
          return asNum(l, "<=") <= asNum(r, "<=");
        case ">=":
          return asNum(l, ">=") >= asNum(r, ">=");
        default:
          throw new ExprError(`Unknown operator "${ast.op}".`);
      }
    }
    case "call": {
      // `if` is a lazy special form so only the taken branch evaluates.
      if (ast.name === "if") {
        if (ast.args.length !== 3) throw new ExprError("if() takes exactly 3 arguments: if(cond, a, b).");
        return truthy(evaluate(ast.args[0]!, env)) ? evaluate(ast.args[1]!, env) : evaluate(ast.args[2]!, env);
      }
      const fn = HELPERS[ast.name];
      if (!fn) throw new ExprError(`Unknown helper "${ast.name}".`);
      const args = ast.args.map((a) => evaluate(a, env));
      return fn(args);
    }
    default:
      throw new ExprError("Malformed expression.");
  }
}

/** Convenience: compile-and-run in one call (used by display layers). */
export function run(src: string, env: Env): Value {
  return evaluate(parse(src), env);
}
