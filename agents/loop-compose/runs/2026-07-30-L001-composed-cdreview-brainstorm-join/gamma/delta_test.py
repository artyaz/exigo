#!/usr/bin/env python3
"""
Wave γ delta-test for loop-compose run 2026-07-30-L001.

Question the delta-test answers (agents/loop-compose/LOOP.md, "Delta-test
(canonical)"): does the composed loop exhibit a measurable property that
NEITHER parent alone exhibits? Admit IFF composed strictly beats both baselines.

Method — port-anchored capability probing
----------------------------------------
The property is decomposed into 7 artifact classes. A protocol "can emit" an
artifact class only when BOTH kinds of evidence are present in its own spec:

  * PORT evidence  — its typed `ports:` block declares a port that carries it
  * WAVE evidence  — its protocol body declares a wave/gate that produces it

Requiring both is what stops this from degenerating into keyword-grepping:
incidental prose ("we should measure things some day") produces wave-ish text
with no port to carry the artifact, and scores zero.

Every hit reports the file, line number and matched text so any claim in the
verdict can be audited by hand. Misses report which of the two evidence kinds
was absent.

Two modes
---------
  --mode contract : composed capability is read from the composition contract
                    (used at γ time, before Wave δ has authored anything)
  --mode authored : composed capability is read from the authored LOOP.md
                    (re-run at ε time to prove δ delivered what γ promised)

Usage:
  python3 delta_test.py <repo_root> --mode contract|authored --out <file.json>
"""

import argparse
import json
import os
import re
import sys

# ---------------------------------------------------------------------------
# Artifact classes making up the declared property
# ---------------------------------------------------------------------------
# port_re : matched against the ports: block region only
# wave_re : matched against the whole protocol body
ARTIFACT_CLASSES = [
    {
        "id": "audit_finding",
        "label": "Severity-classified audit finding with a code:line citation",
        "port_re": r"name:\s*(audit|findings?)-port|\{name:\s*(audit|findings?)-port",
        "wave_re": r"P0\s*\|.*(security|auth|data loss)|Severity:\s*P0\|P1\|P2\|P3",
    },
    {
        "id": "verified_dossier",
        "label": "Externally-verified dossier carrying a 3-state verdict",
        "port_re": r"name:\s*dossiers?-port|\{name:\s*dossiers?-port",
        "wave_re": r"ADVANCE\s*/\s*REFUTE\s*/\s*INCONCLUSIVE|ADVANCE`?\s*/\s*`?REFUTE",
    },
    {
        "id": "verified_citation",
        "label": "Citation verified against a TTL-bounded cache",
        "port_re": r"name:\s*citations?-port|\{name:\s*citations?-port",
        "wave_re": r"citations?\.jsonl.*TTL|TTL.*citations?\.jsonl|7-day TTL",
    },
    {
        "id": "before_measurement",
        "label": "Metric captured BEFORE the edit is written",
        "port_re": r"name:\s*measurements?-port|\{name:\s*measurements?-port",
        "wave_re": r"before[- ]measurement|baseline measurement|M-\S*-before",
    },
    {
        "id": "after_measurement",
        "label": "Same metric re-captured AFTER the edit",
        "port_re": r"name:\s*measurements?-port|\{name:\s*measurements?-port",
        "wave_re": r"after[- ]measurement|M-\S*-after",
    },
    {
        "id": "measured_delta",
        "label": "Computed before/after delta with an improved|neutral|regressed call",
        "port_re": r"name:\s*measurements?-port|\{name:\s*measurements?-port",
        "wave_re": r"delta_computed|improved\|neutral\|regressed|measured delta",
    },
    {
        "id": "shipped_diff",
        "label": "Repo-write: a diff/PR actually shipped",
        "port_re": r"type:\s*git-diff|type:\s*github-pr-url",
        "wave_re": r"gh pr create|git push|develop_merged|main_merged",
    },
    {
        "id": "refutation_veto",
        "label": "Record of a written, green change BLOCKED by a verdict",
        "port_re": r"name:\s*refutations?-port|\{name:\s*refutations?-port|"
                   r"name:\s*verified-improvements-port|\{name:\s*verified-improvements-port",
        # A bare "veto" would match any prose mention, so the wave probe requires
        # a structured form: a declared gate step, a ship-block record, or a
        # named failed conjunct.
        "wave_re": r"evidence_gate\S*veto|evidence_gate:\S*\{pass\|veto\}|ship_blocked"
                   r"|REFUTE vetoes|failed_conjunct",
    },
]

PORTS_REGION = re.compile(r"```yaml\n(.*?)\n```|^---\n(.*?)\n---", re.DOTALL | re.M)


def ports_region(text):
    """Locate the declared interface block.

    Returns (body, line_offset, (start_char, end_char)).

    `line_offset` is the 0-based count of lines before the block body, so a body
    index `i` maps to 1-based source line `line_offset + i + 1`. The `+ 1` in the
    return accounts for the opening fence / `---` occupying its own line — the
    body begins on the line AFTER the delimiter.

    The char span is returned so wave-evidence scanning can EXCLUDE this region;
    see `probe()`.
    """
    for m in PORTS_REGION.finditer(text):
        body = m.group(1) or m.group(2) or ""
        if "ports:" in body:
            return body, text[:m.start()].count("\n") + 1, (m.start(), m.end())
    return "", 0, (0, 0)


def norm(line):
    """Undo markdown pipe-escaping before matching.

    Inside a markdown table cell a literal `|` must be written `\\|`. That is a
    formatting artifact with no semantic content, so `Severity: P0\\|P1\\|P2`
    and `Severity: P0|P1|P2` must probe identically. Without this, a protocol
    would score differently depending on whether a vocabulary happened to be
    documented in a table or in a fenced block.
    """
    return line.replace("\\|", "|")


def body_lines(text, pspan):
    """Protocol-body lines, with the declared-interface region blanked out.

    Wave evidence MUST come from the protocol body. If the ports region were left
    in scope, a single port `description:` string could satisfy both conjuncts and
    the two-evidence rule would collapse into one — a loop could then score by
    declaring an interface it never implements. Blanked lines keep their index so
    reported line numbers stay true to the source.
    """
    ps, pe = pspan
    out, off = [], 0
    for raw in text.split("\n"):
        start, end = off, off + len(raw)
        overlaps = start < pe and end > ps
        out.append("" if overlaps else norm(raw))
        off = end + 1
    return out


def probe(path, label):
    with open(path, "r", encoding="utf-8") as fh:
        text = fh.read()
    pregion, poffset, pspan = ports_region(text)
    plines = [norm(x) for x in pregion.split("\n")]
    blines = body_lines(text, pspan)

    results = {}
    for spec in ARTIFACT_CLASSES:
        port_hit = None
        for i, line in enumerate(plines):
            if re.search(spec["port_re"], line, re.I):
                port_hit = {"line": poffset + i + 1, "text": line.strip()[:150]}
                break
        wave_hit = None
        for i, line in enumerate(blines):
            if re.search(spec["wave_re"], line, re.I):
                wave_hit = {"line": i + 1, "text": line.strip()[:150]}
                break

        can = bool(port_hit) and bool(wave_hit)
        missing = []
        if not port_hit:
            missing.append("no port declares this artifact")
        if not wave_hit:
            missing.append("no wave/gate in the protocol body produces this artifact")

        results[spec["id"]] = {
            "label": spec["label"],
            "can_emit": can,
            "port_evidence": port_hit,
            "wave_evidence": wave_hit,
            "missing": missing,
        }
    return {"subject": label, "source": path, "artifacts": results,
            "score": sum(1 for r in results.values() if r["can_emit"])}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("repo")
    ap.add_argument("--mode", choices=["contract", "authored"], default="contract")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    run = "agents/loop-compose/runs/2026-07-30-L001-composed-cdreview-brainstorm-join"
    if args.mode == "contract":
        composed_src = os.path.join(args.repo, run, "composition-contract.md")
        composed_label = "composed (declared by composition contract)"
    else:
        composed_src = os.path.join(args.repo, "agents/cdreview-brainstorm-join/LOOP.md")
        composed_label = "composed (as authored by Wave δ)"

    if not os.path.exists(composed_src):
        sys.exit("composed source missing: %s" % composed_src)

    subjects = [
        probe(os.path.join(args.repo, "agents/cd-review/LOOP.md"),
              "baseline_a (cd-review alone)"),
        probe(os.path.join(args.repo, "agents/brainstorm/LOOP.md"),
              "baseline_b (brainstorm alone)"),
        probe(composed_src, composed_label),
    ]
    a, b, c = subjects

    union = [s["id"] for s in ARTIFACT_CLASSES]
    composed_full = all(c["artifacts"][k]["can_emit"] for k in union)
    a_missing = [k for k in union if not a["artifacts"][k]["can_emit"]]
    b_missing = [k for k in union if not b["artifacts"][k]["can_emit"]]

    beats_a = c["score"] > a["score"] and len(a_missing) > 0
    beats_b = c["score"] > b["score"] and len(b_missing) > 0
    # Degeneracy guard (B-003 I-003-DELTA): the composed loop must not merely
    # reproduce one parent's capability set — it must add something to BOTH.
    adds_to_a = [k for k in a_missing if c["artifacts"][k]["can_emit"]]
    adds_to_b = [k for k in b_missing if c["artifacts"][k]["can_emit"]]
    non_degenerate = bool(adds_to_a) and bool(adds_to_b)

    verdict = "ADMIT" if (composed_full and beats_a and beats_b and non_degenerate) else "REJECT"

    out = {
        "run_id": os.path.basename(run),
        "mode": args.mode,
        "artifact_union": union,
        "scores": {s["subject"]: "%d/%d" % (s["score"], len(union)) for s in subjects},
        "baseline_a_missing": a_missing,
        "baseline_b_missing": b_missing,
        "composed_emits_full_union": composed_full,
        "composed_beats_baseline_a": beats_a,
        "composed_beats_baseline_b": beats_b,
        "capabilities_added_over_a": adds_to_a,
        "capabilities_added_over_b": adds_to_b,
        "non_degenerate": non_degenerate,
        "verdict": verdict,
        "detail": subjects,
    }
    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=2)
        fh.write("\n")

    print("mode=%s" % args.mode)
    for s in subjects:
        print("  %-46s %d/%d" % (s["subject"], s["score"], len(union)))
    print("  baseline_a missing: %s" % ", ".join(a_missing))
    print("  baseline_b missing: %s" % ", ".join(b_missing))
    print("  non_degenerate=%s  VERDICT=%s" % (non_degenerate, verdict))
    return 0 if verdict == "ADMIT" else 1


if __name__ == "__main__":
    sys.exit(main())
