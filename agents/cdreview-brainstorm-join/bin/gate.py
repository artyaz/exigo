#!/usr/bin/env python3
"""
Evidence Gate evaluator for `cdreview-brainstorm-join` (LOOP.md §11).

Recomputes the ship/veto decision from ON-DISK ARTIFACTS ALONE, so a resumed
agent never has to trust a remembered decision (LOOP.md §13.2.7). Every conjunct
is a veto:

    SHIP  IFF  dossier.verdict == ADVANCE
          AND  >=1 citation verified within the TTL
          AND  M-<hyp>-before.json exists AND its git_sha is an ancestor of HEAD
          AND  M-<hyp>-after.json exists for the same metric
          AND  delta in {improved, neutral}
          AND  wave_d_verdict == accept_and_ship
          AND  no L6 finding at P1 or above

Usage
-----
  gate.py --run-root DIR --pack P-002 --hyp H-003 [--repo .] [--ttl-days 7]

Ancestry is verified against the tree each baseline was measured in (its recorded
`git_dir`), so there is no way to skip the check. A conjunct that reports PASS
without performing its check turns the gate into a claim rather than a test.

Exit 0 = pass, 1 = veto. Writes gate/gate-<PACK>.md always, and appends to
gate/refutations.jsonl on veto.
"""

import argparse
import glob
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timedelta

# Reuse the harness's record selector so the gate and the harness can never
# disagree about which measurement record is newest.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from measure import measurement_records  # noqa: E402

SEV_RANK = {"P0": 0, "P1": 1, "P2": 2, "P3": 3}


def now_iso():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def parse_iso(s):
    s = (s or "").strip().rstrip("Z")
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


# ---------------------------------------------------------------------------
# Artifact readers
# ---------------------------------------------------------------------------

def read_dossier(run_root, hyp):
    hits = sorted(glob.glob(os.path.join(run_root, "dossiers", "V-*-%s.md" % hyp)))
    if not hits:
        return None, "no dossier matching V-*-%s.md" % hyp
    with open(hits[-1], encoding="utf-8") as fh:
        text = fh.read()

    verdict = None
    m = re.search(r"^\s*-?\s*verdict:\s*\**\s*(ADVANCE|REFUTE|INCONCLUSIVE)",
                  text, re.M | re.I)
    if m:
        verdict = m.group(1).upper()

    qual = None
    q = re.search(r"^\s*-?\s*qualifier:\s*([0-9.]+)", text, re.M | re.I)
    if q:
        qual = float(q.group(1))

    # citations: lines carrying a url plus a status and a fetched_at
    cites = []
    for line in text.split("\n"):
        if "http" not in line:
            continue
        url = re.search(r"(https?://\S+?)(?:[)\]\s,]|$)", line)
        status = re.search(r"status[=:\s]+(\d{3})", line, re.I)
        fetched = re.search(r"fetched_at[=:\s]+([0-9T:\-]+Z?)", line, re.I)
        if url and status:
            cites.append({
                "url": url.group(1),
                "status": int(status.group(1)),
                "fetched_at": fetched.group(1) if fetched else None,
            })
    return {"path": hits[-1], "verdict": verdict, "qualifier": qual,
            "citations": cites, "text": text}, None


def read_wave_d(run_root, pack):
    p = os.path.join(run_root, "audits", "pre-pr", "%s.md" % pack)
    if not os.path.exists(p):
        return None, "no consolidated Wave D file at audits/pre-pr/%s.md" % pack
    with open(p, encoding="utf-8") as fh:
        text = fh.read()
    # Anchor to a LABELLED verdict and take the LAST one. An unanchored search
    # returns the leftmost token anywhere in the document, so a vocabulary legend
    # or a sentence like "this would normally be accept_and_ship, but..." could
    # outrank the real verdict — and if the stray token were accept_and_ship the
    # gate would fail OPEN. Two accepted forms:
    #   "Verdict: accept_and_ship"     (inline field)
    #   "## Verdict\naccept_and_ship"  (heading followed by the bare token)
    # No labelled verdict found ⇒ None ⇒ the wave_d_accept conjunct fails closed.
    TOKENS = r"(send_back_to_wave_F|fix_and_proceed|accept_and_ship)"
    found = re.findall(r"^\s*[-*]?\s*\**\s*verdict\s*\**\s*:\s*\**\s*" + TOKENS,
                       text, re.M | re.I)
    found += re.findall(r"^\s*#{1,6}\s*\**\s*verdict\b[^\n]*\n+\s*[-*]?\s*\**\s*"
                        + TOKENS, text, re.M | re.I)
    verdict = found[-1] if found else None
    # L6 findings: "D-<pack>-L6-<nnn>" with a Severity line nearby
    l6 = []
    for block in re.split(r"\n(?=#{2,4}\s)", text):
        if re.search(r"\bL6\b", block):
            for sm in re.finditer(r"Severity:\s*\**\s*(P[0-3])", block, re.I):
                l6.append(sm.group(1).upper())
    return {"path": p, "verdict": verdict, "l6_severities": l6}, None


def newest_measure(run_root, hyp, phase):
    mdir = os.path.join(run_root, "measure")
    recs = measurement_records(mdir, "M-%s-%s" % (hyp, phase))
    if not recs:
        return None
    chosen = recs[-1][1]
    with open(os.path.join(mdir, chosen), encoding="utf-8") as fh:
        d = json.load(fh)
    d["_file"] = chosen
    return d


def read_delta(run_root, hyp):
    p = os.path.join(run_root, "measure", "measurements.jsonl")
    if not os.path.exists(p):
        return None
    best = None
    with open(p, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                r = json.loads(line)
            except ValueError:
                continue
            if r.get("hypothesis_id") == hyp:
                best = r          # last wins
    return best


def is_ancestor(sha, repo):
    if not sha or sha == "unknown":
        return False, "baseline git_sha is unknown"
    inside = subprocess.run(["git", "rev-parse", "--is-inside-work-tree"],
                            cwd=repo, capture_output=True, text=True)
    if inside.returncode != 0:
        return False, "%s is not a git work tree, so baseline ancestry cannot be " \
                      "verified" % repo
    p = subprocess.run(["git", "merge-base", "--is-ancestor", sha, "HEAD"],
                       cwd=repo, capture_output=True, text=True)
    if p.returncode == 0:
        return True, None
    return False, "baseline sha %s is not an ancestor of HEAD in %s" % (sha[:12], repo)


# ---------------------------------------------------------------------------


def evaluate(args):
    conj = []          # (name, passed, detail)

    def add(name, ok, detail):
        conj.append({"conjunct": name, "pass": bool(ok), "detail": detail})

    dossier, derr = read_dossier(args.run_root, args.hyp)
    if derr:
        add("dossier_advance", False, derr)
        add("citation_verified", False, "no dossier")
    else:
        add("dossier_advance", dossier["verdict"] == "ADVANCE",
            "verdict=%s (%s)" % (dossier["verdict"], os.path.basename(dossier["path"])))

        cutoff = datetime.utcnow() - timedelta(days=args.ttl_days)
        good = []
        for c in dossier["citations"]:
            if c["status"] != 200:
                continue
            ts = parse_iso(c["fetched_at"])
            if ts is None or ts < cutoff:
                continue
            good.append(c)
        add("citation_verified", len(good) >= 1,
            "%d/%d citations are 200 and within %dd TTL"
            % (len(good), len(dossier["citations"]), args.ttl_days))

    before = newest_measure(args.run_root, args.hyp, "before")
    after = newest_measure(args.run_root, args.hyp, "after")

    if before is None:
        add("baseline_exists", False,
            "M-%s-before.json missing — measurement did not precede mutation (§8.1)" % args.hyp)
        add("baseline_precedes_edit", False, "no baseline")
    else:
        add("baseline_exists", True, "%s value=%s" % (before["_file"], before["value"]))
        # Ancestry is checked against the tree the baseline was actually measured
        # in (recorded as git_dir), falling back to --repo for older records.
        # There is deliberately no skip flag: a conjunct that reports PASS without
        # performing its check makes the whole gate a claim rather than a test.
        tree = before.get("git_dir") or args.repo
        ok, why = is_ancestor(before.get("git_sha"), tree)
        add("baseline_precedes_edit", ok,
            why or "baseline sha %s is an ancestor of HEAD in %s"
            % ((before.get("git_sha") or "?")[:12], tree))

    if after is None:
        add("after_exists", False, "M-%s-after.json missing" % args.hyp)
    else:
        same = before is not None and \
            before["metric"]["name"] == after["metric"]["name"]
        add("after_exists", same,
            "%s value=%s%s" % (after["_file"], after["value"],
                               "" if same else " (METRIC MISMATCH)"))

    d = read_delta(args.run_root, args.hyp)
    if d is None:
        add("delta_not_regressed", False, "no delta record in measure/measurements.jsonl")
    else:
        add("delta_not_regressed", d["delta"] in ("improved", "neutral"),
            "delta=%s (%s %s -> %s, %+.1f%%)" % (
                d["delta"], d["metric"], d["before"], d["after"], d["pct_change"]))

    wd, werr = read_wave_d(args.run_root, args.pack)
    if werr:
        add("wave_d_accept", False, werr)
        add("no_l6_p1", False, "no Wave D file")
    else:
        add("wave_d_accept", wd["verdict"] == "accept_and_ship",
            "wave_d_verdict=%s" % wd["verdict"])
        worst = min([SEV_RANK.get(s, 9) for s in wd["l6_severities"]] or [9])
        add("no_l6_p1", worst > SEV_RANK["P1"],
            "L6 findings=%s (worst=%s)" % (wd["l6_severities"] or "none",
                                           "none" if worst == 9 else
                                           [k for k, v in SEV_RANK.items() if v == worst][0]))

    failed = [c for c in conj if not c["pass"]]
    verdict = "pass" if not failed else "veto"

    # ------------------------------------------------------------------ report
    gdir = os.path.join(args.run_root, "gate")
    os.makedirs(gdir, exist_ok=True)
    lines = [
        "# Evidence Gate — %s" % args.pack, "",
        "**Pack:** `%s`  **Hypothesis:** `%s`  " % (args.pack, args.hyp),
        "**Verdict: %s**  " % verdict.upper(),
        "**Evaluated:** %s by `bin/gate.py` (re-derivable from disk, §13.2.7)" % now_iso(),
        "",
        "| Conjunct | Result | Detail |",
        "|----------|:------:|--------|",
    ]
    for c in conj:
        lines.append("| `%s` | %s | %s |" % (
            c["conjunct"], "PASS" if c["pass"] else "**VETO**", c["detail"]))
    lines += ["", "Every conjunct is a veto (LOOP.md §11).", ""]
    if failed:
        lines += ["## Failed conjuncts", ""]
        lines += ["- `%s` — %s" % (c["conjunct"], c["detail"]) for c in failed]
        lines += ["",
                  "Per §11.1 the pack is reverted, `ship_blocked:%s:%s` is recorded, and the"
                  % (args.pack, failed[0]["conjunct"]),
                  "loop continues to the next pack. A veto is a result, not a blocker.", ""]
    with open(os.path.join(gdir, "gate-%s.md" % args.pack), "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")

    if failed:
        rec = {
            "pack_id": args.pack,
            "hypothesis_id": args.hyp,
            "failed_conjunct": failed[0]["conjunct"],
            "all_failed": [c["conjunct"] for c in failed],
            "detail": failed[0]["detail"],
            "verdict_at": now_iso(),
            "disposition": "reverted",
        }
        # Idempotent append: a resumed agent re-runs the in-flight step
        # (cd-review §8.3.1), and a duplicate refutation would double-count the
        # gate-veto-storm stop condition (LOOP.md §16.2).
        rpath = os.path.join(gdir, "refutations.jsonl")
        key = (rec["pack_id"], rec["hypothesis_id"], rec["failed_conjunct"])
        existing = set()
        if os.path.exists(rpath):
            with open(rpath, encoding="utf-8") as fh:
                for line in fh:
                    try:
                        r = json.loads(line)
                    except ValueError:
                        continue
                    existing.add((r.get("pack_id"), r.get("hypothesis_id"),
                                  r.get("failed_conjunct")))
        if key not in existing:
            with open(rpath, "a", encoding="utf-8") as fh:
                fh.write(json.dumps(rec) + "\n")
        else:
            print("  (refutation already recorded; not duplicating)")

    print("evidence_gate:%s:%s" % (args.pack, verdict))
    for c in conj:
        print("  %-26s %s  %s" % (c["conjunct"], "PASS" if c["pass"] else "VETO", c["detail"]))
    return 0 if verdict == "pass" else 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--run-root", required=True)
    ap.add_argument("--pack", required=True)
    ap.add_argument("--hyp", required=True)
    ap.add_argument("--repo", default=".")
    ap.add_argument("--ttl-days", type=int, default=7)
    sys.exit(evaluate(ap.parse_args()))


if __name__ == "__main__":
    main()
