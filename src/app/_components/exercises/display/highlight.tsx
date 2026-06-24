"use client";
/* Lightweight syntax tokenizer for the inline IDE editor. Ported in spirit
   from the reference exerciseRuntime: a regex pass that classifies code into
   token spans painted by the `.exg-hl` classes (see styles.ts). Not a real
   parser — just enough structure to read like an IDE. */
import React from "react";

export type TokenClass = "com" | "str" | "num" | "kw" | "type" | "fn" | "id" | "pun" | "op" | "ws";
export interface Token {
  cls: TokenClass;
  text: string;
}

const KEYWORDS = new Set([
  "const", "let", "var", "function", "return", "if", "else", "for", "while", "do",
  "break", "continue", "new", "typeof", "instanceof", "in", "of", "class", "extends",
  "super", "this", "null", "true", "false", "undefined", "void", "switch", "case",
  "default", "throw", "try", "catch", "finally", "delete", "yield", "await", "async",
  // a few cross-language keywords so non-JS locked text still reads sanely
  "fn", "let", "mut", "match", "impl", "pub", "use", "struct", "enum", "def", "print",
]);

/** Classify `code` into a flat token stream. */
export function tokenizeCode(code: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  const n = code.length;
  const push = (cls: TokenClass, text: string): void => {
    if (text) out.push({ cls, text });
  };
  while (i < n) {
    const ch = code[i]!;
    // whitespace
    if (/\s/.test(ch)) {
      let j = i + 1;
      while (j < n && /\s/.test(code[j]!)) j++;
      push("ws", code.slice(i, j));
      i = j;
      continue;
    }
    // line comment
    if (ch === "/" && code[i + 1] === "/") {
      let j = i + 2;
      while (j < n && code[j] !== "\n") j++;
      push("com", code.slice(i, j));
      i = j;
      continue;
    }
    // block comment
    if (ch === "/" && code[i + 1] === "*") {
      let j = i + 2;
      while (j < n && !(code[j] === "*" && code[j + 1] === "/")) j++;
      j = Math.min(n, j + 2);
      push("com", code.slice(i, j));
      i = j;
      continue;
    }
    // string
    if (ch === '"' || ch === "'" || ch === "`") {
      let j = i + 1;
      while (j < n && code[j] !== ch) {
        if (code[j] === "\\") j++;
        j++;
      }
      j = Math.min(n, j + 1);
      push("str", code.slice(i, j));
      i = j;
      continue;
    }
    // number
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(code[i + 1] ?? ""))) {
      let j = i + 1;
      while (j < n && /[0-9._eExXa-fA-F]/.test(code[j]!)) j++;
      push("num", code.slice(i, j));
      i = j;
      continue;
    }
    // identifier / keyword
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_$]/.test(code[j]!)) j++;
      const word = code.slice(i, j);
      let k = j;
      while (k < n && /\s/.test(code[k]!)) k++;
      const isCall = code[k] === "(";
      const cls: TokenClass = KEYWORDS.has(word)
        ? "kw"
        : isCall
          ? "fn"
          : /^[A-Z]/.test(word)
            ? "type"
            : "id";
      push(cls, word);
      i = j;
      continue;
    }
    // operators
    if ("+-*/%<>=!&|?:".includes(ch)) {
      let j = i + 1;
      while (j < n && "+-*/%<>=!&|?:".includes(code[j]!)) j++;
      push("op", code.slice(i, j));
      i = j;
      continue;
    }
    // punctuation (everything else, char by char)
    push("pun", ch);
    i++;
  }
  return out;
}

/** Render highlighted code as token spans. */
export function Highlight({ code }: { code: string }): React.JSX.Element {
  const tokens = React.useMemo(() => tokenizeCode(code), [code]);
  return (
    <span className="exg-hl">
      {tokens.map((t, i) =>
        t.cls === "ws" ? (
          <span key={i} className="ws">
            {t.text}
          </span>
        ) : (
          <span key={i} className={t.cls}>
            {t.text}
          </span>
        ),
      )}
    </span>
  );
}
