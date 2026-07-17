/* ═══════════════════════════════════════════════════════════════════
   EXIGO AAP — Curated-trace harness: rust-ownership-move (v1 family).
   Scenario family: move vs clone for a non-Copy value (String).
   This does NOT run rustc — it encodes a tested model of the borrow
   checker's behaviour for this narrow family. Per §2.1 it ships
   ground-truth tests; per §2.2 a codeProbe using it may only offer
   constrained holes/choices, never free-form Rust.
   ═══════════════════════════════════════════════════════════════════ */
import type { CuratedTraceHarness, RunResult, SlotValues } from "./types";

type Move = "move" | "clone" | "borrow";

/** Classify the learner's choice for line 2 into the modelled cases. */
function classify(line: string): Move {
  const s = line.trim();
  if (/\.clone\s*\(\s*\)/.test(s)) return "clone";
  if (/=\s*&/.test(s)) return "borrow";
  return "move";
}

function traceFor(kind: Move): RunResult {
  const head = [
    { label: "line 1", text: "let a = String::from(\"hi\");" },
  ];
  if (kind === "move") {
    return {
      ok: false,
      log: [],
      trace: [
        ...head,
        { label: "line 2", text: "let b = a;", note: "ownership of the String moves from `a` into `b`" },
        { label: "line 3", text: "println!(\"{}\", a);", note: "`a` was moved — it no longer owns a value" },
        { label: "error", text: "error[E0382]: borrow of moved value: `a`", out: true },
      ],
      error: "use-after-move",
    };
  }
  if (kind === "clone") {
    return {
      ok: true,
      log: [],
      trace: [
        ...head,
        { label: "line 2", text: "let b = a.clone();", note: "a deep copy is made — `a` keeps its own String" },
        { label: "line 3", text: "println!(\"{}\", a);", note: "`a` is still valid" },
        { label: "ok", text: "compiles — both `a` and `b` own a String", out: true },
      ],
      error: null,
    };
  }
  return {
    ok: true,
    log: [],
    trace: [
      ...head,
      { label: "line 2", text: "let b = &a;", note: "`b` borrows `a` — no ownership transfer" },
      { label: "line 3", text: "println!(\"{}\", a);", note: "`a` still owns its String while borrowed" },
      { label: "ok", text: "compiles — `a` owns, `b` borrows", out: true },
    ],
    error: null,
  };
}

export const rustOwnershipMove: CuratedTraceHarness = {
  id: "rust-ownership-move",
  kind: "curated-trace",
  domain: "rust",
  scenarioFamily: "move-vs-clone-noncopy",
  languages: ["rust"],
  groundTruthTests: [
    {
      name: "String move invalidates source binding",
      slots: { line2: "let b = a;" },
      expected: { ok: false, contains: ["moved"], notContains: ["compiles"] },
      oracle: "golden-trace",
    },
    {
      name: "use-after-move fails compilation",
      slots: { line2: "let b = a;" },
      expected: { ok: false, contains: ["E0382"] },
      oracle: "golden-trace",
    },
    {
      name: "clone keeps source binding valid",
      slots: { line2: "let b = a.clone();" },
      expected: { ok: true, contains: ["compiles"], notContains: ["E0382"] },
      oracle: "golden-trace",
    },
    {
      name: "reference borrow keeps source valid",
      slots: { line2: "let b = &a;" },
      expected: { ok: true, contains: ["borrows"] },
      oracle: "golden-trace",
    },
  ],
  trace(input: SlotValues): RunResult {
    const line = typeof input.line2 === "string" ? input.line2 : "let b = a;";
    return traceFor(classify(line));
  },
  run(source: string): RunResult {
    // `source` is the assembled program; line 2 carries the chosen hole.
    const line2 = source.split("\n").find((l) => /let\s+b\s*=/.test(l)) ?? "let b = a;";
    return traceFor(classify(line2));
  },
};
