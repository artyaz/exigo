#!/usr/bin/env python3
"""
Wave M metric harness for `cdreview-brainstorm-join` (LOOP.md §8).

Captures the metric a dossier declared, before and after the edit, and writes an
immutable measurement record. Dependency-free so it runs inside the sealed ε
canary (no network, no npm) as well as in a normal cycle.

Usage
-----
  measure.py --run-root DIR --hyp H-003 --phase before|after \\
             --metric max_function_loc --direction lower_is_better \\
             [--target FILE...] [--command "..."] [--runs 3] [--pack P-002]

  measure.py --run-root DIR --hyp H-003 --delta        # compute before/after delta

Immutability (LOOP.md §13.2.6): if the target record already exists, the harness
refuses to overwrite it and writes `<name>.r2.json` instead, recording that a
re-measure happened. Silently rewriting a baseline is how a loop lies to itself.
"""

import argparse
import json
import os
import re
import statistics
import subprocess
import sys
import time

# ---------------------------------------------------------------------------
# Metric registry
# ---------------------------------------------------------------------------


def m_wall_seconds(args):
    """Median wall-clock seconds of --command over --runs runs."""
    if not args.command:
        sys.exit("wall_seconds requires --command")
    runs = []
    for _ in range(args.runs):
        t0 = time.perf_counter()
        p = subprocess.run(args.command, shell=True, capture_output=True, text=True)
        dt = time.perf_counter() - t0
        if p.returncode != 0:
            sys.exit("metric command failed (rc=%d): %s" % (p.returncode, p.stderr[:400]))
        runs.append(round(dt, 6))
    return runs


def _read_targets(args):
    if not args.target:
        sys.exit("this metric requires --target")
    out = []
    for t in args.target:
        with open(t, "r", encoding="utf-8", errors="replace") as fh:
            out.append((t, fh.read()))
    return out


def m_loc(args):
    """Non-blank, non-comment-only lines across --target."""
    total = 0
    for _, text in _read_targets(args):
        for line in text.split("\n"):
            s = line.strip()
            if s and not s.startswith(("//", "#", "*", "/*")):
                total += 1
    return [total]


def m_exported_symbols(args):
    n = 0
    for _, text in _read_targets(args):
        n += len(re.findall(r"^\s*export\s+(?:default\s+)?(?:async\s+)?"
                            r"(?:function|const|class|let|var|type|interface|enum)\b",
                            text, re.M))
    return [n]


def m_max_function_loc(args):
    """Longest brace-balanced function/def body across --target."""
    worst = 0
    for _, text in _read_targets(args):
        lines = text.split("\n")
        # python-style
        for i, line in enumerate(lines):
            if re.match(r"^\s*def\s+\w+", line):
                indent = len(line) - len(line.lstrip())
                j = i + 1
                while j < len(lines):
                    s = lines[j]
                    if s.strip() and (len(s) - len(s.lstrip())) <= indent:
                        break
                    j += 1
                worst = max(worst, j - i)
        # brace-style
        for i, line in enumerate(lines):
            if re.search(r"\b(function\s+\w+|=>\s*\{|\w+\s*\([^)]*\)\s*\{)", line):
                depth, j, started = 0, i, False
                while j < len(lines):
                    depth += lines[j].count("{") - lines[j].count("}")
                    if "{" in lines[j]:
                        started = True
                    if started and depth <= 0:
                        break
                    j += 1
                worst = max(worst, j - i + 1)
    return [worst]


def m_duplicate_blocks(args):
    """Count of 5-line windows appearing more than once across --target."""
    seen, dupes = {}, 0
    for _, text in _read_targets(args):
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        for i in range(max(0, len(lines) - 4)):
            key = "\n".join(lines[i:i + 5])
            seen[key] = seen.get(key, 0) + 1
    for k, v in seen.items():
        if v > 1:
            dupes += v - 1
    return [dupes]


def m_command_number(args):
    """Run --command and parse the last integer/float it prints."""
    if not args.command:
        sys.exit("command_number requires --command")
    runs = []
    for _ in range(args.runs):
        p = subprocess.run(args.command, shell=True, capture_output=True, text=True)
        nums = re.findall(r"-?\d+(?:\.\d+)?", p.stdout or "")
        if not nums:
            sys.exit("command printed no number: %s" % (p.stdout or p.stderr)[:300])
        runs.append(float(nums[-1]))
    return runs


REGISTRY = {
    "wall_seconds": m_wall_seconds,
    "loc": m_loc,
    "loc_touched_surface": m_loc,
    "exported_symbols": m_exported_symbols,
    "max_function_loc": m_max_function_loc,
    "duplicate_blocks": m_duplicate_blocks,
    "command_number": m_command_number,
}


# ---------------------------------------------------------------------------


def git_sha(cwd="."):
    p = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True, cwd=cwd)
    return p.stdout.strip() if p.returncode == 0 else "unknown"


def now():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def capture(args):
    fn = REGISTRY.get(args.metric)
    if fn is None:
        sys.exit("unknown metric %r; known: %s" % (args.metric, ", ".join(sorted(REGISTRY))))

    runs = fn(args)
    value = statistics.median(runs)
    stdev = statistics.stdev(runs) if len(runs) > 1 else 0.0

    rec = {
        "hypothesis_id": args.hyp,
        "pack_id": args.pack,
        "phase": args.phase,
        "metric": {
            "name": args.metric,
            "command": args.command,
            "target": args.target,
            "direction": args.direction,
            "unit": args.unit,
        },
        "runs": runs,
        "value": value,
        "stdev": round(stdev, 6),
        "git_sha": git_sha(),
        "captured_at": now(),
    }

    mdir = os.path.join(args.run_root, "measure")
    os.makedirs(mdir, exist_ok=True)
    base = os.path.join(mdir, "M-%s-%s" % (args.hyp, args.phase))
    path = base + ".json"

    # Immutability guard (LOOP.md §13.2.6)
    if os.path.exists(path):
        n = 2
        while os.path.exists("%s.r%d.json" % (base, n)):
            n += 1
        path = "%s.r%d.json" % (base, n)
        rec["remeasure_of"] = base + ".json"
        rec["remeasure_reason"] = args.remeasure_reason or "unspecified"
        print("WARN baseline exists; writing re-measure %s" % os.path.basename(path))

    with open(path, "w", encoding="utf-8") as fh:
        json.dump(rec, fh, indent=2)
        fh.write("\n")
    print("%s  %s=%s (runs=%s stdev=%s)" % (
        os.path.basename(path), args.metric, value, runs, rec["stdev"]))
    return rec


def load_phase(run_root, hyp, phase):
    """Load the newest record for a phase (re-measures win)."""
    mdir = os.path.join(run_root, "measure")
    base = "M-%s-%s" % (hyp, phase)
    cands = [f for f in os.listdir(mdir)
             if f.startswith(base) and f.endswith(".json")] if os.path.isdir(mdir) else []
    if not cands:
        return None, None
    # plain .json is r1; .rN.json sorts after
    cands.sort(key=lambda f: (0 if f == base + ".json" else int(
        re.search(r"\.r(\d+)\.json$", f).group(1))))
    chosen = cands[-1]
    with open(os.path.join(mdir, chosen), encoding="utf-8") as fh:
        return json.load(fh), chosen


def delta(args):
    before, bf = load_phase(args.run_root, args.hyp, "before")
    after, af = load_phase(args.run_root, args.hyp, "after")
    if before is None:
        sys.exit("MISSING BASELINE for %s — gate must veto (LOOP.md §8.1)" % args.hyp)
    if after is None:
        sys.exit("missing after-measurement for %s" % args.hyp)

    if before["metric"]["name"] != after["metric"]["name"]:
        sys.exit("metric mismatch: before=%s after=%s" % (
            before["metric"]["name"], after["metric"]["name"]))

    direction = before["metric"]["direction"]
    b, a = before["value"], after["value"]
    raw = a - b
    # Noise discipline (LOOP.md §8.3): only call improved/regressed when the
    # move clears 2x the baseline's own run-to-run stdev.
    threshold = 2 * max(before.get("stdev", 0.0), after.get("stdev", 0.0))
    if abs(raw) <= threshold:
        call = "neutral"
    elif (raw < 0) == (direction == "lower_is_better"):
        call = "improved"
    else:
        call = "regressed"

    pct = (raw / b * 100.0) if b else 0.0
    rec = {
        "hypothesis_id": args.hyp,
        "pack_id": after.get("pack_id") or before.get("pack_id"),
        "metric": before["metric"]["name"],
        "direction": direction,
        "before": b, "after": a,
        "raw_delta": round(raw, 6),
        "pct_change": round(pct, 3),
        "noise_threshold": round(threshold, 6),
        "delta": call,
        "before_record": bf, "after_record": af,
        "before_git_sha": before["git_sha"], "after_git_sha": after["git_sha"],
        "computed_at": now(),
    }
    out = os.path.join(args.run_root, "measure", "measurements.jsonl")
    with open(out, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(rec) + "\n")
    print("delta_computed:%s:%s  %s %s -> %s (%+.1f%%, noise±%.4f)" % (
        rec["pack_id"], call, rec["metric"], b, a, pct, threshold))
    return rec


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--run-root", required=True)
    ap.add_argument("--hyp", required=True)
    ap.add_argument("--pack", default=None)
    ap.add_argument("--phase", choices=["before", "after"])
    ap.add_argument("--metric")
    ap.add_argument("--direction", choices=["lower_is_better", "higher_is_better"],
                    default="lower_is_better")
    ap.add_argument("--unit", default="count")
    ap.add_argument("--target", action="append")
    ap.add_argument("--command")
    ap.add_argument("--runs", type=int, default=3)
    ap.add_argument("--remeasure-reason")
    ap.add_argument("--delta", action="store_true")
    args = ap.parse_args()

    if args.delta:
        delta(args)
    else:
        if not args.phase or not args.metric:
            sys.exit("--phase and --metric are required unless --delta")
        capture(args)


if __name__ == "__main__":
    main()
