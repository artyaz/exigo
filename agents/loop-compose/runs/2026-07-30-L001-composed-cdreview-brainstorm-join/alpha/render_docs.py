#!/usr/bin/env python3
"""Render the alpha enumeration + beta verdict markdown from the engine JSON.

Tables are generated, never transcribed, so the prose cannot drift from the
computed verdicts.

Usage: python3 render_docs.py <run_root>
"""
import json
import os
import sys

RR = sys.argv[1] if len(sys.argv) > 1 else "."
alpha = json.load(open(os.path.join(RR, "alpha/port-binding-enumeration.json")))
beta = json.load(open(os.path.join(RR, "beta/verdicts.json")))

C = beta["verdict_counts"]


def row(r):
    return "| `%s` | `%s`<br>`%s` | `%s`<br>`%s` | %s | **%s** | %s |" % (
        r["direction"], r["from_port"], r["from_type"], r["to_port"], r["to_type"],
        ("`%s`" % r["adapter"]) if r["adapter"] else "—",
        r["verdict"], r["semantic_class"],
    )


HDR = ("| Dir | From (port / type) | To (port / type) | Adapter | Verdict | Semantic class |\n"
       "|-----|--------------------|------------------|---------|---------|----------------|")

# ---------------------------------------------------------------- alpha doc
a, b = alpha["loop_a"], alpha["loop_b"]
lines = [
    "# Wave α — Pair enumeration",
    "",
    "**Run:** `%s`  " % alpha["run_id"],
    "**Executed by:** orchestrator solo (per `agents/loop-compose/LOOP.md` §α)  ",
    "**Engine:** [`enumerate_bindings.py`](./enumerate_bindings.py) — parses the",
    "`ports:` blocks out of the two parent `LOOP.md` files directly, so this table is",
    "*computed from the real specs*, not asserted by hand. Re-run with:",
    "",
    "```bash",
    "python3 agents/loop-compose/runs/%s/alpha/enumerate_bindings.py . \\" % alpha["run_id"],
    "        agents/loop-compose/runs/%s" % alpha["run_id"],
    "```",
    "",
    "## Parents",
    "",
    "| Role | Loop | Source | Inputs | Outputs |",
    "|------|------|--------|--------|---------|",
    "| A | `%s` | `%s` | %d | %d |" % (a["loop_id"], a["path"], a["n_inputs"], a["n_outputs"]),
    "| B | `%s` | `%s` | %d | %d |" % (b["loop_id"], b["path"], b["n_inputs"], b["n_outputs"]),
    "",
    "**A inputs:** %s  " % ", ".join("`%s`" % p for p in a["inputs"]),
    "**A outputs:** %s  " % ", ".join("`%s`" % p for p in a["outputs"]),
    "**B inputs:** %s  " % ", ".join("`%s`" % p for p in b["inputs"]),
    "**B outputs:** %s" % ", ".join("`%s`" % p for p in b["outputs"]),
    "",
    "## Candidate count",
    "",
    "Both directions are enumerated because the intent (\"review → improve → and then",
    "review better next cycle\") is a cycle, not a one-way pipe:",
    "",
    "```",
    "A→B : outputs(A) × inputs(B) = %d × %d = %d" % (a["n_outputs"], b["n_inputs"], a["n_outputs"] * b["n_inputs"]),
    "B→A : outputs(B) × inputs(A) = %d × %d = %d" % (b["n_outputs"], a["n_inputs"], b["n_outputs"] * a["n_inputs"]),
    "total                        = %d candidate bindings" % alpha["candidate_binding_count"],
    "```",
    "",
    "## Enumeration (all %d candidates)" % alpha["candidate_binding_count"],
    "",
    "Verdicts in this table are the Wave β output, shown here so the enumeration and",
    "its disposition can be read in one pass. The decision procedure is in",
    "[`../beta/verdicts.md`](../beta/verdicts.md).",
    "",
    "### A→B (`cd-review` output → `brainstorm` input)",
    "",
    HDR,
]
lines += [row(r) for r in alpha["candidates"] if r["direction"] == "A->B"]
lines += ["", "### B→A (`brainstorm` output → `cd-review` input)", "", HDR]
lines += [row(r) for r in alpha["candidates"] if r["direction"] == "B->A"]
lines += [
    "",
    "## Totals",
    "",
    "| Verdict | Count |",
    "|---------|-------|",
    "| COMPOSE | %d |" % C.get("COMPOSE", 0),
    "| CONFLICT | %d |" % C.get("CONFLICT", 0),
    "| ORTHOGONAL | %d |" % C.get("ORTHOGONAL", 0),
    "| **total** | **%d** |" % alpha["candidate_binding_count"],
    "",
    "Of the %d COMPOSE edges, %d are semantically admissible and %d are PRIMARY:" % (
        C.get("COMPOSE", 0), len(beta["bindable_edges"]), len(beta["primary_edges"])),
    "",
]
lines += ["- `%s`" % e for e in beta["primary_edges"]]
lines += [
    "",
    "Those two PRIMARY edges are the forward edge and the feedback edge of the",
    "composed loop. Everything else is either type-noise, a degenerate re-run of a",
    "parent's own wave, or a resume-contract collision.",
    "",
]
open(os.path.join(RR, "alpha/port-binding-enumeration.md"), "w").write("\n".join(lines) + "\n")

# ---------------------------------------------------------------- beta doc
def group(pred):
    return [r for r in beta["verdicts"] if pred(r)]


bl = [
    "# Wave β — 3-state composition verdict",
    "",
    "**Run:** `%s`  " % beta["run_id"],
    "**Executed by:** orchestrator solo, using the canonical 3-state verdict from",
    "`agents/loop-compose/LOOP.md` (\"3-state composition verdict (canonical)\").",
    "",
    "## Decision procedure (applied in this order, per the canonical spec)",
    "",
    "1. **Type-match** — does the output port have a type-compatible adapter to the",
    "   input port? If no → `ORTHOGONAL`.",
    "2. **Resource-collision** — do the two loops claim overlapping external",
    "   side-effects? If yes → `CONFLICT`.",
    "3. **Default** → `COMPOSE`.",
    "",
    "### The type lattice (explicit, so the verdict is auditable)",
    "",
    "| Output type | Input type | Adapter | Note |",
    "|-------------|-----------|---------|------|",
    "| *T* | *T* | `identity` | same type binds trivially |",
    "| `markdown-file(s)` | `text` | `digest` | markdown *is* text |",
    "| `git-diff` | `text` | `diff_digest` | a unified diff *is* text |",
    "| `json-file` | `jsonl` | `wrap_single` | one object is a 1-line JSONL doc |",
    "| `markdown-file(s)` | `jsonl` | `extract_records` | lossy but well-defined |",
    "| `github-pr-url` | *any* | **none** | needs a network fetch; no adapter exists under the sealed-canary constraints the ship-gate itself imposes |",
    "",
    "The lattice is deliberately **permissive**. Narrowing the type layer to",
    "manufacture a convenient answer would hide the real work, so type-compatibility",
    "stays mechanical and a *separate* semantic-admissibility annotation records why",
    "a type-compatible edge may still be left unbound. The semantic column never",
    "changes a verdict — it only decides what the contract binds.",
    "",
    "### The CONFLICT class found here",
    "",
    "The two founder loops have disjoint run-root prefixes",
    "(`agents/cd-review/<date>/` vs `agents/brainstorm/runs/<...>/`) and disjoint",
    "`loop_id` namespaces, so there is no directory or namespace collision. The live",
    "collision is the **resume contract**: both parents export a `record-port` and a",
    "`day-status-port`. A composed loop has exactly one orchestrator writing exactly",
    "one `RECORD.md` and one `day-status.json`, so treating a parent's",
    "record/status file as *composable data* is a single-writer collision on the one",
    "artifact C-001-can-04 makes load-bearing.",
    "",
    "All %d CONFLICT verdicts are this single class." % C.get("CONFLICT", 0),
    "",
    "### CONFLICT resolution (required before ship)",
    "",
    beta["conflict_resolution"],
    "",
    "## Verdicts",
    "",
    "### COMPOSE (%d)" % C.get("COMPOSE", 0),
    "",
    HDR,
]
bl += [row(r) for r in group(lambda r: r["verdict"] == "COMPOSE")]
bl += ["", "### CONFLICT (%d)" % C.get("CONFLICT", 0), "", HDR]
bl += [row(r) for r in group(lambda r: r["verdict"] == "CONFLICT")]
bl += ["", "### ORTHOGONAL (%d)" % C.get("ORTHOGONAL", 0), "", HDR]
bl += [row(r) for r in group(lambda r: r["verdict"] == "ORTHOGONAL")]

bl += ["", "## Semantic rationale for the classified edges", ""]
seen = set()
for r in beta["verdicts"]:
    if r["semantic_class"] == "UNCLASSIFIED":
        continue
    key = (r["from_port"], r["to_port"])
    if key in seen:
        continue
    seen.add(key)
    bl += ["**`%s → %s`** — %s  " % (r["from_port"], r["to_port"], r["semantic_class"]),
           "%s" % r["semantic_rationale"], ""]

bl += [
    "## Bound edges (what the contract actually wires)",
    "",
]
bl += ["- **PRIMARY** `%s`" % e for e in beta["primary_edges"]]
bl += [
    "",
    "Secondary-admissible edges are recorded but left unbound this cycle to keep the",
    "composed loop's dataflow single-purpose; they are listed in the contract's",
    "`deferred_bindings` for a future cycle.",
    "",
    "**Verdict: PROCEED to Wave γ** — %d COMPOSE edges exist, %d are semantically" % (
        C.get("COMPOSE", 0), len(beta["bindable_edges"])),
    "admissible, and the CONFLICT class has a resolution that does not require",
    "refuse-to-ship. The novelty-decay stop condition (0 COMPOSE verdicts) is not",
    "triggered.",
    "",
]
open(os.path.join(RR, "beta/verdicts.md"), "w").write("\n".join(bl) + "\n")

print("wrote alpha/port-binding-enumeration.md and beta/verdicts.md")
