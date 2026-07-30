#!/usr/bin/env python3
"""
Negative controls for the Evidence Gate (LOOP.md §11).

A gate that only ever reports PASS is a claim, not a test. Every conjunct here is
driven to FAIL on purpose, so the gate is demonstrably load-bearing rather than
decorative. Each case also pins a specific fail-OPEN bug so it cannot return.

Run:
    python3 agents/cdreview-brainstorm-join/bin/selftest.py

Exit 0 when every conjunct fails as designed. Suitable as a CI gate.
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
GATE = os.path.join(HERE, "gate.py")
sys.path.insert(0, HERE)
from measure import measurement_records  # noqa: E402

FRESH = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))


def head_sha():
    p = subprocess.run(["git", "rev-parse", "HEAD"], cwd=REPO,
                       capture_output=True, text=True)
    return p.stdout.strip() if p.returncode == 0 else "unknown"


DOSSIER_OK = """# V-001 — H-001
- claim: a set-based membership test is linear
- grounds: in-repo ground at workspace/dedupe.py:8
- qualifier: 0.80
- backing: https://example.invalid/x status: 200 fetched_at: %s
- verdict: ADVANCE
- change_surface: workspace/dedupe.py
"""

WAVE_D_OK = """# Wave D consolidated review — P-001

## Verdict
accept_and_ship

Lenses run: L1, L2, L3, L4, L6
"""


def build_case(tmp, *, dossier=None, wave_d=None, before=True, after=True,
               delta="improved", before_sha=None, metric="wall_seconds",
               after_metric=None, extra_measure_files=()):
    """Materialise a minimal, on-disk run root for one gate evaluation."""
    rr = tempfile.mkdtemp(dir=tmp)
    for sub in ("dossiers", "measure", "audits/pre-pr", "gate"):
        os.makedirs(os.path.join(rr, sub), exist_ok=True)

    with open(os.path.join(rr, "dossiers/V-001-H-001.md"), "w", encoding="utf-8") as fh:
        fh.write(dossier if dossier is not None else DOSSIER_OK % FRESH)
    with open(os.path.join(rr, "audits/pre-pr/P-001.md"), "w", encoding="utf-8") as fh:
        fh.write(wave_d if wave_d is not None else WAVE_D_OK)

    sha = before_sha if before_sha is not None else head_sha()

    def rec(phase, value, mname):
        return {
            "hypothesis_id": "H-001", "pack_id": "P-001", "phase": phase,
            "metric": {"name": mname, "command": "x", "target": None,
                       "direction": "lower_is_better", "unit": "seconds"},
            "runs": [value], "value": value, "stdev": 0.0,
            "git_sha": sha, "git_dir": REPO, "captured_at": FRESH,
        }

    if before:
        with open(os.path.join(rr, "measure/M-H-001-before.json"), "w",
                  encoding="utf-8") as fh:
            json.dump(rec("before", 1.0, metric), fh)
    if after:
        with open(os.path.join(rr, "measure/M-H-001-after.json"), "w",
                  encoding="utf-8") as fh:
            json.dump(rec("after", 0.5, after_metric or metric), fh)

    for name in extra_measure_files:
        with open(os.path.join(rr, "measure", name), "w", encoding="utf-8") as fh:
            fh.write("{}")

    if delta is not None:
        with open(os.path.join(rr, "measure/measurements.jsonl"), "w",
                  encoding="utf-8") as fh:
            fh.write(json.dumps({
                "hypothesis_id": "H-001", "pack_id": "P-001",
                "metric": metric, "direction": "lower_is_better",
                "before": 1.0, "after": 0.5, "raw_delta": -0.5,
                "pct_change": -50.0, "noise_threshold": 0.0, "delta": delta,
            }) + "\n")
    return rr


def run_gate(rr):
    p = subprocess.run([sys.executable, GATE, "--run-root", rr,
                        "--pack", "P-001", "--hyp", "H-001", "--repo", REPO],
                       capture_output=True, text=True)
    return p.returncode, p.stdout + p.stderr


def conjunct_failed(out, name):
    for line in out.split("\n"):
        if line.strip().startswith(name) and "VETO" in line:
            return True
    return False


CASES = []


def case(name, expect_conjunct, pins):
    def deco(fn):
        CASES.append((name, expect_conjunct, pins, fn))
        return fn
    return deco


@case("baseline missing", "baseline_exists",
      "measure-before-mutate (§8.1) — a pack with no baseline must not ship")
def c_no_baseline(tmp):
    return build_case(tmp, before=False)


@case("baseline sha not an ancestor", "baseline_precedes_edit",
      "fail-OPEN pin: the ancestry conjunct used to be skippable and reported PASS "
      "without checking anything")
def c_bad_ancestor(tmp):
    # A well-formed but unrelated SHA (git's empty-tree object is never a commit
    # ancestor of HEAD), so the check must reject it.
    return build_case(tmp, before_sha="4b825dc642cb6eb9a060e54bf8d69288fbee4904")


@case("baseline sha unknown", "baseline_precedes_edit",
      "an unrecorded SHA must not be treated as a passing ancestry check")
def c_unknown_sha(tmp):
    return build_case(tmp, before_sha="unknown")


@case("after-measurement missing", "after_exists",
      "an unmeasured outcome cannot be called an optimization (§2)")
def c_no_after(tmp):
    return build_case(tmp, after=False)


@case("metric changed between before and after", "after_exists",
      "swapping the metric mid-pack would make the delta meaningless")
def c_metric_mismatch(tmp):
    return build_case(tmp, after_metric="loc")


@case("declared metric regressed", "delta_not_regressed",
      "the property the whole loop exists for: a green, lens-approved diff that "
      "made the number worse must not ship")
def c_regressed(tmp):
    return build_case(tmp, delta="regressed")


@case("dossier verdict is REFUTE", "dossier_advance",
      "REFUTE vetoes an already-written diff (§11.1)")
def c_refute(tmp):
    return build_case(tmp, dossier=DOSSIER_OK.replace("verdict: ADVANCE",
                                                      "verdict: REFUTE") % FRESH)


@case("citation stale beyond TTL", "citation_verified",
      "a citation outside the 7-day TTL is not verification (§7.2)")
def c_stale_citation(tmp):
    return build_case(tmp, dossier=DOSSIER_OK % "2020-01-01T00:00:00Z")


@case("citation non-200", "citation_verified",
      "an unreachable source is not verification")
def c_dead_citation(tmp):
    return build_case(tmp, dossier=(DOSSIER_OK % FRESH).replace("status: 200",
                                                                "status: 404"))


@case("Wave D verdict is send_back", "wave_d_accept",
      "the gate must read the real verdict")
def c_send_back(tmp):
    return build_case(tmp, wave_d=WAVE_D_OK.replace("accept_and_ship",
                                                    "send_back_to_wave_F"))


@case("stray accept_and_ship in prose before the real verdict", "wave_d_accept",
      "fail-OPEN pin: an unanchored leftmost regex read the FIRST token anywhere in "
      "the file, so prose could outrank the recorded verdict")
def c_prose_decoy(tmp):
    doc = ("# Wave D consolidated review — P-001\n\n"
           "## Notes\n"
           "The verdict vocabulary is send_back_to_wave_F / fix_and_proceed /\n"
           "accept_and_ship. Under other circumstances this would have been\n"
           "accept_and_ship, but two P1 findings remain.\n\n"
           "## Verdict\nsend_back_to_wave_F\n")
    return build_case(tmp, wave_d=doc)


@case("no labelled verdict at all", "wave_d_accept",
      "absent evidence must fail CLOSED, not default to shipping")
def c_no_verdict(tmp):
    return build_case(tmp, wave_d="# Wave D consolidated review — P-001\n\n"
                                  "Looks good to me.\n")


@case("L6 finding at P1", "no_l6_p1",
      "the evidence lens can veto alone (§10.1)")
def c_l6_p1(tmp):
    return build_case(tmp, wave_d=WAVE_D_OK + (
        "\n### D-P-001-L6-001: metric moves for unrelated reasons\n"
        "- Severity: P1\n"))


def main():
    tmp = tempfile.mkdtemp(prefix="gate-selftest-")
    failures = []
    try:
        # --- positive control: the happy path must PASS, or the negatives below
        # --- would be meaningless (everything failing proves nothing).
        rr = build_case(tmp)
        rc, out = run_gate(rr)
        if rc != 0:
            failures.append("POSITIVE CONTROL: happy path should pass but vetoed\n" + out)
            print("positive control            FAIL (happy path vetoed)")
        else:
            print("positive control            pass (happy path ships)")

        # --- negative controls
        for name, conjunct, pins, fn in CASES:
            rr = fn(tmp)
            rc, out = run_gate(rr)
            vetoed = rc == 1
            right_reason = conjunct_failed(out, conjunct)
            ok = vetoed and right_reason
            print("%-46s %s  (%s)" % (
                name, "pass" if ok else "FAIL", conjunct))
            if not ok:
                failures.append("%s: vetoed=%s right_conjunct=%s\n%s"
                                % (name, vetoed, right_reason, out))
            _ = pins

        # --- record selector: a stray file must not crash the gate
        mdir = tempfile.mkdtemp(dir=tmp)
        for n in ("M-H-1-before.json", "M-H-1-before.r2.json",
                  "M-H-1-before.bak.json", "M-H-10-before.json", "notes.txt"):
            open(os.path.join(mdir, n), "w").close()
        try:
            recs = measurement_records(mdir, "M-H-1-before")
            names = [f for _, f in recs]
            ok = names == ["M-H-1-before.json", "M-H-1-before.r2.json"]
            print("%-46s %s  (exact-shape match, r2 newest)"
                  % ("record selector ignores stray files", "pass" if ok else "FAIL"))
            if not ok:
                failures.append("record selector returned %s" % names)
        except Exception as e:                                  # noqa: BLE001
            print("%-46s FAIL  (%s)" % ("record selector ignores stray files", e))
            failures.append("record selector raised %r" % e)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    print()
    if failures:
        print("SELFTEST FAIL — %d case(s)" % len(failures))
        for f in failures:
            print("\n" + f[:800])
        return 1
    print("SELFTEST PASS — every conjunct fails when it should, and the happy "
          "path still ships")
    return 0


if __name__ == "__main__":
    sys.exit(main())
