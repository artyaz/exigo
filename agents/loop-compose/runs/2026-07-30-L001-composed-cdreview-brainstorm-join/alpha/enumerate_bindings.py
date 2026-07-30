#!/usr/bin/env python3
"""
Wave alpha + beta engine for loop-compose run 2026-07-30-L001.

Reads the REAL `ports:` blocks out of two parent LOOP.md files, enumerates every
candidate port binding in both directions, and computes the canonical 3-state
composition verdict (COMPOSE / CONFLICT / ORTHOGONAL) per
agents/loop-compose/LOOP.md "3-state composition verdict (canonical)".

No third-party dependencies on purpose: this has to be re-runnable in a sealed
canary and in CI, where `pip install` is not available.

Usage:
    python3 enumerate_bindings.py <repo_root> <out_dir>

Emits:
    <out_dir>/alpha/port-binding-enumeration.json
    <out_dir>/beta/verdicts.json
"""

import json
import os
import re
import sys
from itertools import product

# ---------------------------------------------------------------------------
# 1. Minimal ports-block parser
# ---------------------------------------------------------------------------

PORTS_FENCE = re.compile(r"```yaml\n(.*?)\n```", re.DOTALL)


def _strip_quotes(v):
    v = v.strip()
    if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
        return v[1:-1]
    return v


def _parse_inline_mapping(body):
    """Parse `{name: x, type: y, required: true}` without a YAML lib.

    Splits on commas that are not inside quotes or brackets.
    """
    out, buf, depth, quote = {}, "", 0, None
    parts = []
    for ch in body:
        if quote:
            buf += ch
            if ch == quote:
                quote = None
            continue
        if ch in "\"'":
            quote = ch
            buf += ch
            continue
        if ch in "[{":
            depth += 1
        elif ch in "]}":
            depth -= 1
        if ch == "," and depth == 0:
            parts.append(buf)
            buf = ""
            continue
        buf += ch
    if buf.strip():
        parts.append(buf)
    for p in parts:
        if ":" not in p:
            continue
        k, v = p.split(":", 1)
        out[k.strip()] = _strip_quotes(v)
    return out


def parse_ports(loop_md_path):
    """Extract {loop_id, ports:{inputs,outputs}, last_step_vocabulary, lineage}."""
    with open(loop_md_path, "r", encoding="utf-8") as fh:
        text = fh.read()

    # The ports block is the first ```yaml fence that contains "ports:".
    block = None
    for m in PORTS_FENCE.finditer(text):
        if "ports:" in m.group(1):
            block = m.group(1)
            break
    if block is None:
        # loop-compose / forged loops use `---` frontmatter instead of a fence.
        fm = re.match(r"^---\n(.*?)\n---", text, re.DOTALL)
        if fm and "ports:" in fm.group(1):
            block = fm.group(1)
    if block is None:
        raise SystemExit("no ports: block found in %s" % loop_md_path)

    loop_id = None
    m = re.search(r"^loop_id:\s*(\S+)", block, re.M)
    if m:
        loop_id = m.group(1)

    ports = {"inputs": [], "outputs": []}
    section = None          # 'inputs' | 'outputs' | None
    current = None
    in_ports = False

    for raw in block.split("\n"):
        line = raw.rstrip()
        if not line.strip() or line.strip().startswith("#"):
            continue
        indent = len(line) - len(line.lstrip())
        stripped = line.strip()

        if re.match(r"^ports:\s*$", stripped):
            in_ports = True
            continue
        if in_ports and indent == 0 and not stripped.startswith("-"):
            # left the ports: block (e.g. last_step_vocabulary:, lineage:)
            in_ports = False
        if not in_ports:
            continue

        if re.match(r"^(inputs|outputs):\s*$", stripped):
            section = stripped[:-1]
            current = None
            continue
        if section is None:
            continue

        if stripped.startswith("- "):
            item = stripped[2:].strip()
            if item.startswith("{"):
                current = _parse_inline_mapping(item.strip("{}"))
                ports[section].append(current)
                current = None
            else:
                current = {}
                ports[section].append(current)
                if ":" in item:
                    k, v = item.split(":", 1)
                    current[k.strip()] = _strip_quotes(v)
        elif current is not None and ":" in stripped:
            k, v = stripped.split(":", 1)
            current[k.strip()] = _strip_quotes(v)

    vocab = []
    vm = re.search(r"^last_step_vocabulary:\s*(.*?)$", block, re.M)
    if vm:
        tail = vm.group(1).strip()
        if tail.startswith("["):
            vocab = [s.strip() for s in tail.strip("[]").split(",") if s.strip()]
        else:
            after = block[vm.end():]
            for raw in after.split("\n"):
                s = raw.strip()
                if s.startswith("- "):
                    vocab.append(s[2:].strip())
                elif s and not s.startswith("#") and not raw.startswith("  "):
                    break

    return {
        "loop_id": loop_id,
        "path": loop_md_path,
        "inputs": ports["inputs"],
        "outputs": ports["outputs"],
        "last_step_vocabulary": vocab,
    }


# ---------------------------------------------------------------------------
# 2. Type lattice
# ---------------------------------------------------------------------------
# Permissive on purpose: the canonical rule is "type-compatible -> COMPOSE".
# We do NOT quietly narrow the type layer to get a convenient answer. Instead a
# separate semantic-admissibility layer (section 3) records why a
# type-compatible edge may still be left unbound by the contract.

TYPE_COMPAT = {
    ("text", "text"): "identity",
    ("jsonl", "jsonl"): "identity",
    ("json-file", "json-file"): "identity",
    ("markdown-file", "markdown-file"): "identity",
    ("markdown-files", "markdown-files"): "identity",
    ("directory-path", "directory-path"): "identity",
    ("enum", "enum"): "identity",
    # markdown IS text -> a digest adapter is lossless enough to bind
    ("markdown-files", "text"): "digest",
    ("markdown-file", "text"): "digest",
    # a unified diff is text
    ("git-diff", "text"): "diff_digest",
    # a single JSON object is a 1-line JSONL document (lossless wrap)
    ("json-file", "jsonl"): "wrap_single",
    # markdown -> jsonl requires an extractor; lossy but well-defined
    ("markdown-file", "jsonl"): "extract_records",
    ("markdown-files", "jsonl"): "extract_records",
}

# Types whose content cannot be resolved inside a sealed canary run (no network),
# so no adapter exists under the ship-gate's own constraints.
UNRESOLVABLE_UNDER_SEAL = {"github-pr-url"}


def type_compat(out_type, in_type):
    if out_type in UNRESOLVABLE_UNDER_SEAL:
        return None, "requires network fetch; no adapter exists under sealed-canary constraints"
    adapter = TYPE_COMPAT.get((out_type, in_type))
    if adapter:
        return adapter, None
    return None, "no adapter in type lattice for %s -> %s" % (out_type, in_type)


# ---------------------------------------------------------------------------
# 3. Resource-collision (CONFLICT) detection
# ---------------------------------------------------------------------------
# Per agents/loop-compose/LOOP.md: CONFLICT when the two loops "claim overlapping
# external side-effects (same runs/ prefix, same MAX_OPEN_PRS budget, same
# loop_id namespace)".
#
# The founder pair have disjoint run-root prefixes, so the live collision class
# here is the RESUME CONTRACT: both parents declare a record-port and a
# day-status-port. A composed loop has exactly ONE orchestrator writing exactly
# ONE RECORD.md and ONE day-status.json, so any binding that treats a parent's
# record/status file as composable data is a single-writer collision on the
# resume contract that C-001-can-04 makes load-bearing.

RESUME_CONTRACT_PORTS = {"record-port", "day-status-port"}


def resource_collision(a_port, b_port):
    reasons = []
    if a_port["name"] in RESUME_CONTRACT_PORTS or b_port["name"] in RESUME_CONTRACT_PORTS:
        reasons.append(
            "resume-contract single-writer collision: %s/%s is owned by the "
            "composed loop's own orchestrator (C-001-can-04), not bindable as data"
            % (a_port["name"], b_port["name"])
        )
    return reasons


# ---------------------------------------------------------------------------
# 4. Semantic admissibility (annotation only — does NOT change the verdict)
# ---------------------------------------------------------------------------

SEMANTIC_NOTES = {
    ("audit-port", "problem-statement-port"): (
        "ADMISSIBLE-PRIMARY",
        "Hostile audit findings are exactly the problem statement an improvement "
        "hypothesis should answer. This is the forward edge of the intent.",
    ),
    ("constraints-port", "slice-map-port"): (
        "ADMISSIBLE-PRIMARY",
        "Verified constraints from cycle N re-aim which slices/lenses cycle N+1 "
        "audits. This is the feedback edge that makes the composition a join "
        "rather than a one-shot pipe.",
    ),
    ("claims-port", "problem-statement-port"): (
        "ADMISSIBLE-SECONDARY",
        "Verified claims can seed the next cycle's problem statement, but they are "
        "downstream of audit-port and would shadow it if bound in the same cycle.",
    ),
    ("brainstorms-port", "problem-statement-port"): (
        "INADMISSIBLE-DEGENERATE",
        "cd-review Wave B already produces fix-ideas. Feeding them into brainstorm "
        "alpha to produce more ideas is the B-003 I-003-DELTA degenerate case: "
        "'composition = one parent renamed with extra steps'.",
    ),
    ("fixes-port", "problem-statement-port"): (
        "ADMISSIBLE-SECONDARY",
        "A shipped diff can be a problem statement ('what did this change miss?'), "
        "but it is a post-hoc review edge, not the improvement edge we need.",
    ),
    ("citations-port", "prior-fixes-port"): (
        "INADMISSIBLE-TYPE-COINCIDENCE",
        "Both are jsonl so the type layer binds them, but a citation record is not "
        "a fix record. Binding would corrupt cd-review's idempotency check.",
    ),
    ("dossiers-port", "slice-map-port"): (
        "ADMISSIBLE-SECONDARY",
        "Dossiers could re-aim the slice map, but constraints-port is the "
        "purpose-built, already-consolidated form of the same signal.",
    ),
    ("ideas-port", "slice-map-port"): (
        "INADMISSIBLE-UNVERIFIED",
        "Wave alpha ideas are explicitly unverified. Letting them steer what gets "
        "audited would import brainstorm's divergence without its verification.",
    ),
    ("claims-port", "slice-map-port"): (
        "ADMISSIBLE-SECONDARY",
        "Redundant with constraints-port, which is the decayed/prioritised form.",
    ),
}


def semantic_note(a_name, b_name):
    return SEMANTIC_NOTES.get((a_name, b_name), (
        "UNCLASSIFIED",
        "Type layer permits the edge; no intent-level role identified for this run.",
    ))


# ---------------------------------------------------------------------------
# 5. Enumerate + verdict
# ---------------------------------------------------------------------------

def enumerate_pairs(src, dst, direction):
    rows = []
    for out_p, in_p in product(src["outputs"], dst["inputs"]):
        adapter, why_not = type_compat(out_p.get("type", "?"), in_p.get("type", "?"))
        collisions = resource_collision(out_p, in_p)
        sem_class, sem_why = semantic_note(out_p["name"], in_p["name"])

        # Canonical decision procedure, in the spec's order:
        #   1. no type match            -> ORTHOGONAL
        #   2. resource collision       -> CONFLICT
        #   3. default                  -> COMPOSE
        if adapter is None:
            verdict, rationale = "ORTHOGONAL", why_not
        elif collisions:
            verdict, rationale = "CONFLICT", "; ".join(collisions)
        else:
            verdict, rationale = "COMPOSE", "type-compatible via adapter=%s" % adapter

        rows.append({
            "binding_id": "%s:%s->%s" % (direction, out_p["name"], in_p["name"]),
            "direction": direction,
            "from_loop": src["loop_id"],
            "from_port": out_p["name"],
            "from_type": out_p.get("type", "?"),
            "to_loop": dst["loop_id"],
            "to_port": in_p["name"],
            "to_type": in_p.get("type", "?"),
            "adapter": adapter,
            "verdict": verdict,
            "rationale": rationale,
            "semantic_class": sem_class,
            "semantic_rationale": sem_why,
        })
    return rows


def main():
    repo = sys.argv[1] if len(sys.argv) > 1 else "."
    out_dir = sys.argv[2] if len(sys.argv) > 2 else "."

    a = parse_ports(os.path.join(repo, "agents/cd-review/LOOP.md"))
    b = parse_ports(os.path.join(repo, "agents/brainstorm/LOOP.md"))

    rows = enumerate_pairs(a, b, "A->B") + enumerate_pairs(b, a, "B->A")

    counts = {}
    for r in rows:
        counts[r["verdict"]] = counts.get(r["verdict"], 0) + 1

    bindable = [
        r for r in rows
        if r["verdict"] == "COMPOSE" and r["semantic_class"].startswith("ADMISSIBLE")
    ]

    alpha = {
        "run_id": "2026-07-30-L001-composed-cdreview-brainstorm-join",
        "loop_a": {"loop_id": a["loop_id"], "path": a["path"],
                   "n_inputs": len(a["inputs"]), "n_outputs": len(a["outputs"]),
                   "inputs": [p["name"] for p in a["inputs"]],
                   "outputs": [p["name"] for p in a["outputs"]]},
        "loop_b": {"loop_id": b["loop_id"], "path": b["path"],
                   "n_inputs": len(b["inputs"]), "n_outputs": len(b["outputs"]),
                   "inputs": [p["name"] for p in b["inputs"]],
                   "outputs": [p["name"] for p in b["outputs"]]},
        "candidate_binding_count": len(rows),
        "candidates": rows,
    }

    beta = {
        "run_id": alpha["run_id"],
        "verdict_counts": counts,
        "bindable_edges": [r["binding_id"] for r in bindable],
        "primary_edges": [r["binding_id"] for r in bindable
                          if r["semantic_class"] == "ADMISSIBLE-PRIMARY"],
        "conflict_resolution": (
            "CONFLICT class is entirely the resume-contract single-writer collision "
            "(record-port / day-status-port). Resolution per loop-compose LOOP.md "
            "('rename: loop_b gets a different loop_id namespace'): the composed loop "
            "takes its OWN loop_id namespace and declares ONE record-port + ONE "
            "day-status-port at its own run root, plus its OWN last_step_vocabulary "
            "(C-001-004a). No parent status/record file is bound as data. "
            "Refuse-to-ship is therefore not triggered."
        ),
        "verdicts": rows,
    }

    os.makedirs(os.path.join(out_dir, "alpha"), exist_ok=True)
    os.makedirs(os.path.join(out_dir, "beta"), exist_ok=True)
    with open(os.path.join(out_dir, "alpha/port-binding-enumeration.json"), "w",
              encoding="utf-8") as fh:
        json.dump(alpha, fh, indent=2)
        fh.write("\n")
    with open(os.path.join(out_dir, "beta/verdicts.json"), "w",
              encoding="utf-8") as fh:
        json.dump(beta, fh, indent=2)
        fh.write("\n")

    print("loop_a=%s inputs=%d outputs=%d" % (a["loop_id"], len(a["inputs"]), len(a["outputs"])))
    print("loop_b=%s inputs=%d outputs=%d" % (b["loop_id"], len(b["inputs"]), len(b["outputs"])))
    print("candidates=%d" % len(rows))
    print("verdicts=%s" % json.dumps(counts, sort_keys=True))
    print("bindable=%d -> %s" % (len(bindable), [r["binding_id"] for r in bindable]))


if __name__ == "__main__":
    main()
