#!/usr/bin/env python3
"""
Wave ε kill-and-resume oracle (loop-forge §11.3, loop-compose §ε).

"Mid-canary, the orchestrator kills the target loop at a random `last_step`
(from the target's declared `last_step_vocabulary` — C-001-004a). The
orchestrator then verifies a cold launcher can resume from `day-status.json` +
`RECORD.md` 'Stopped at' alone. If resume fails, the canary FAILS."

Procedure per trial:
  1. pick a random step from the composed loop's DECLARED vocabulary (seeded, recorded)
  2. run the canary fresh with --kill-at STEP        -> must exit 137 (hard kill)
  3. snapshot day-status.json (the only thing a cold launcher may read)
  4. run the canary with --resume, in a FRESH PROCESS with no memory of step 2
  5. assert it reaches state=complete and that the P-001 pass / P-002 veto
     outcomes are identical to the uninterrupted reference run

Multiple trials are run so the result is not one lucky kill point.

Usage: kill_resume_oracle.py --repo . --run-root <epsilon/canary> [--trials 3] [--seed 20260730]
"""

import argparse
import json
import os
import random
import subprocess
import sys

DRIVER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "canary_driver.py")


def load_vocabulary(repo):
    """Read the DECLARED last_step_vocabulary from the composed loop's LOOP.md."""
    path = os.path.join(repo, "agents/cdreview-brainstorm-join/LOOP.md")
    vocab, inside = [], False
    with open(path, encoding="utf-8") as fh:
        for raw in fh:
            s = raw.rstrip("\n")
            if s.startswith("last_step_vocabulary:"):
                inside = True
                continue
            if inside:
                t = s.strip()
                if t.startswith("#"):
                    continue
                if t.startswith("- "):
                    vocab.append(t[2:].strip())
                elif t and not s.startswith(" "):
                    break
    return vocab


def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True)
    return p.returncode, p.stdout, p.stderr


def outcomes(run_root):
    """Extract the observable outcomes a cold launcher would care about."""
    o = {"gate": {}, "state": None, "refutations": 0, "reverted": False}
    sp = os.path.join(run_root, "day-status.json")
    if os.path.exists(sp):
        with open(sp, encoding="utf-8") as fh:
            o["state"] = json.load(fh).get("state")
    for pack in ("P-001", "P-002"):
        gp = os.path.join(run_root, "gate", "gate-%s.md" % pack)
        if os.path.exists(gp):
            txt = open(gp, encoding="utf-8").read()
            o["gate"][pack] = "PASS" if "**Verdict: PASS**" in txt else "VETO"
    rp = os.path.join(run_root, "gate", "refutations.jsonl")
    if os.path.exists(rp):
        o["refutations"] = sum(1 for l in open(rp, encoding="utf-8") if l.strip())
    lp = os.path.join(run_root, "canary-log.jsonl")
    if os.path.exists(lp):
        o["reverted"] = any('"reverted"' in l for l in open(lp, encoding="utf-8"))
    return o


def forbidden_strings(run_root):
    """Pass criterion 3: no HITL language anywhere in the canary log."""
    import re
    pat = re.compile(r"waiting for user|pause for review|ask.*approve", re.I)
    lp = os.path.join(run_root, "canary-log.jsonl")
    if not os.path.exists(lp):
        return ["canary-log.jsonl missing"]
    return [l.strip()[:120] for l in open(lp, encoding="utf-8") if pat.search(l)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default=".")
    ap.add_argument("--run-root", required=True)
    ap.add_argument("--trials", type=int, default=3)
    ap.add_argument("--seed", type=int, default=20260730)
    args = ap.parse_args()

    repo = os.path.abspath(args.repo)
    rr = os.path.abspath(args.run_root)
    vocab = load_vocabulary(repo)
    print("declared last_step_vocabulary: %d entries read from the composed LOOP.md"
          % len(vocab))

    # ---- reference run (uninterrupted) ------------------------------------
    rc, out, err = run([sys.executable, DRIVER, "--repo", repo, "--run-root", rr])
    if rc != 0:
        print("ORACLE FAIL: reference run did not complete (rc=%d)\n%s" % (rc, err[-800:]))
        return 1
    reference = outcomes(rr)
    print("reference run: %s" % json.dumps(reference, sort_keys=True))

    # Kill points must be steps this canary actually executes. Intersect the
    # declared vocabulary with the canary's executed step list, so a trial can
    # never target a step that never happens.
    executed = [l.strip() for l in out.split("\n")]
    from canary_driver import STEPS, SUBSTATE_KILL_POINTS  # noqa: E402
    concrete = [s for s in STEPS if s != "init"]
    # keep only steps whose vocabulary form is declared (templated names match by prefix)
    declared_prefixes = [v.split(":")[0] for v in vocab]
    candidates = [s for s in concrete if s.split(":")[0] in declared_prefixes]

    if not vocab:
        print("ORACLE FAIL: parsed an empty last_step_vocabulary from the composed "
              "LOOP.md — kill points cannot be drawn from the target's own vocabulary "
              "(C-001-004a)")
        return 1
    if not candidates:
        print("ORACLE FAIL: no kill candidates after intersecting the declared "
              "vocabulary with the canary's executed steps")
        return 1

    rng = random.Random(args.seed)
    picks = [("status", lbl) for lbl in SUBSTATE_KILL_POINTS]
    picks += [("step", s) for s in
              rng.sample(candidates, min(args.trials, len(candidates)))]

    trials = []
    for i, (mode, step) in enumerate(picks, 1):
        flag = "--kill-at" if mode == "step" else "--kill-after-status"
        print("\n--- trial %d/%d: kill at %r (%s) ---" % (i, len(picks), step, mode))
        rc1, o1, e1 = run([sys.executable, DRIVER, "--repo", repo,
                           "--run-root", rr, flag, step])
        killed = (rc1 == 137)
        sp = os.path.join(rr, "day-status.json")
        status_at_kill = json.load(open(sp, encoding="utf-8")) if os.path.exists(sp) else None
        print("  kill rc=%s (expected 137)  last_step=%s"
              % (rc1, status_at_kill and status_at_kill.get("last_step")))

        rc2, o2, e2 = run([sys.executable, DRIVER, "--repo", repo,
                           "--run-root", rr, "--resume"])
        resumed = outcomes(rr)
        ok = (killed and rc2 == 0
              and resumed["state"] == "complete"
              and resumed["gate"] == reference["gate"]
              and resumed["refutations"] == reference["refutations"]
              and resumed["reverted"] == reference["reverted"])
        print("  resume rc=%s state=%s gate=%s refutations=%d  -> %s"
              % (rc2, resumed["state"], resumed["gate"], resumed["refutations"],
                 "SUCCESS" if ok else "FAILURE"))
        if mode == "status" and not killed:
            print("  ORACLE MISCONFIGURED: %r was never persisted by the driver, so "
                  "the kill never fired. Either the driver stopped writing that "
                  "label or SUBSTATE_KILL_POINTS is stale." % step)
        if not ok:
            print("  reference=%s\n  resumed  =%s" % (reference, resumed))
            print(e2[-600:])

        trials.append({
            "trial": i,
            "kill_mode": mode,
            "regression_test": mode == "status",
            "killed_at": step,
            "kill_exit_code": rc1,
            "hard_kill_confirmed": killed,
            "status_last_step_at_kill": status_at_kill and status_at_kill.get("last_step"),
            "resume_exit_code": rc2,
            "resume_state": resumed["state"],
            "gate_outcomes": resumed["gate"],
            "refutation_count": resumed["refutations"],
            "matches_reference": resumed["gate"] == reference["gate"],
            "cold_resume": "SUCCESS" if ok else "FAILURE",
        })

    hitl = forbidden_strings(rr)
    loop_md = os.path.join(repo, "agents/cdreview-brainstorm-join/LOOP.md")
    readable = os.path.exists(loop_md) and os.path.getsize(loop_md) > 0

    result = {
        "seed": args.seed,
        "declared_vocabulary_size": len(vocab),
        "candidate_kill_points": len(candidates),
        "reference": reference,
        "trials": trials,
        "pass_criteria": {
            "terminal_state_reached": reference["state"] == "complete",
            "authored_loop_md_readable": readable,
            "no_hitl_strings_in_log": len(hitl) == 0,
            "hitl_matches": hitl,
            # all() is True on an empty list, so without this the oracle could
              # report PASS having executed no trial at all.
              "trials_executed": len(trials) > 0,
              "all_substate_labels_fired": all(
                  t["hard_kill_confirmed"] for t in trials if t["regression_test"]),
              "substate_regressions_covered": sum(
                  1 for t in trials if t["regression_test"]) == len(SUBSTATE_KILL_POINTS),
              "all_trials_resumed": all(t["cold_resume"] == "SUCCESS" for t in trials),
            "gate_property_held": reference["gate"] == {"P-001": "PASS", "P-002": "VETO"},
            "veto_was_reverted": reference["reverted"],
        },
    }
    result["verdict"] = "PASS" if all(
        v for k, v in result["pass_criteria"].items() if isinstance(v, bool)) else "FAIL"

    with open(os.path.join(rr, "kill-resume-results.json"), "w", encoding="utf-8") as fh:
        json.dump(result, fh, indent=2)
        fh.write("\n")

    print("\n=== oracle verdict: %s ===" % result["verdict"])
    for k, v in result["pass_criteria"].items():
        if isinstance(v, bool):
            print("  %-28s %s" % (k, "PASS" if v else "FAIL"))
    return 0 if result["verdict"] == "PASS" else 1


if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    sys.exit(main())
