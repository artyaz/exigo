#!/usr/bin/env python3
"""
Wave ε sealed canary for the composed loop `cdreview-brainstorm-join`.

Runs the composed loop as a leaf worker under reverse-authority, against a spec
drawn from the FIXED trivial-domain corpus (C-001-004b) — "dedupe a list" — and
NOT tailored to the composed loop's capabilities.

Seal (loop-forge §11.1):
  * no human           — nothing reads stdin, no approval points
  * no real git push   — the ship step is stubbed and logged as stubbed
  * no real network     — the citation cache is pre-seeded; nothing is fetched
  * wall-clock budget  — default 300s
  * scratch tree        — all product edits happen in epsilon/canary/workspace/

What is NOT stubbed: the composed loop's own tooling. `bin/measure.py` and
`bin/gate.py` are executed for real, so the canary exercises the actual
measure-before-mutate invariant and the actual conjunctive gate.

Two packs are driven on purpose:
  P-001  a genuine optimization  -> gate PASS
  P-002  a change that regresses the declared metric -> gate VETO
The second is the load-bearing one: it proves a written, green, lens-approved
diff can still be refused, which is the property neither parent loop exhibits.

Usage:
  canary_driver.py --repo . --run-root <epsilon/canary> [--kill-at STEP] [--resume]
                   [--budget-seconds 300]

Exit codes: 0 = reached a terminal state; 137 = killed by the oracle (simulated
SIGKILL); 1 = canary failure.
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))

# The composed loop's declared last_step vocabulary, in execution order for this
# canary. The kill-and-resume oracle picks from THIS list (C-001-004a).
STEPS = [
    "init",
    "cycle_scope_written",
    "stare_decisis_loaded",
    "slice_map_resolved",
    "wave_a_dispatched",
    "wave_a_collected",
    "findings_clustered",
    "wave_h_dispatched",
    "wave_h_collected",
    "hypothesis_shortlist_written",
    "wave_v_dispatched",
    "wave_v_collected",
    "citation_verify",
    "verdict_recorded:H-001:advance",
    "metric_declared:H-001",
    "measure_before:H-001",
    "pack_consolidated:P-001",
    "wave_f_dispatched:P-001",
    "wave_f_collected:P-001",
    "verify_done:P-001",
    "measure_after:P-001",
    "delta_computed:P-001",
    "wave_d_dispatched:P-001:round_1",
    "wave_d_collected:P-001:round_1",
    "wave_d_verdict:P-001:accept_and_ship",
    "evidence_gate:P-001",
    "verdict_recorded:H-002:advance",
    "metric_declared:H-002",
    "measure_before:H-002",
    "pack_consolidated:P-002",
    "wave_f_dispatched:P-002",
    "wave_f_collected:P-002",
    "verify_done:P-002",
    "measure_after:P-002",
    "delta_computed:P-002",
    "wave_d_dispatched:P-002:round_1",
    "wave_d_collected:P-002:round_1",
    "wave_d_verdict:P-002:accept_and_ship",
    "evidence_gate:P-002",
    "constraints_written",
    "develop_pushed",
    "archive_update_started",
    "archive_update_complete",
    "record_finalized",
    "scope_complete",
]

# Statuses the loop persists that are SUB-STATES of a declared step rather than
# steps in their own right. §11.1 writes ship_blocked:<pack>:<reason> and then
# reverted:<pack> while handling a gate veto; both belong to evidence_gate:<pack>.
# Without this map a kill on the veto path leaves a last_step that reduces to
# nothing, and resume silently replays the entire cycle from init.
SUBSTATE_OWNER = {
    "ship_blocked": "evidence_gate",
    "reverted": "evidence_gate",
}

# Annotated labels this driver persists that are NOT plain STEPS entries. Exposed
# so the kill-resume oracle can target them directly via --kill-after-status.
# These are exactly the labels whose mishandling caused a silent full replay, so
# they are a FIXED regression test rather than something random sampling may or
# may not happen to hit.
SUBSTATE_KILL_POINTS = [
    "evidence_gate:P-001:pass",
    "evidence_gate:P-002:veto",
    "ship_blocked:P-002:delta_not_regressed",
    "reverted:P-002",
]


def normalize_step(last):
    """Map a persisted status label back to the STEPS entry that owns it.

    Returns None when the label cannot be mapped — the caller must treat that as
    a protocol violation rather than silently restarting, because a silent full
    replay duplicates RECORD.md content and manufactures undocumented re-measures.
    """
    if last in STEPS:
        return last
    parts = last.split(":")
    if parts[0] in SUBSTATE_OWNER and len(parts) >= 2:
        cand = "%s:%s" % (SUBSTATE_OWNER[parts[0]], parts[1])
        if cand in STEPS:
            return cand
    # annotated variants (e.g. evidence_gate:P-001:pass) — strip right to left
    for n in range(len(parts) - 1, 0, -1):
        cand = ":".join(parts[:n])
        if cand in STEPS:
            return cand
    return None


SLOW_DEDUPE = '''"""dedupe a list — trivial-domain canary target (C-001-004b corpus)."""


def dedupe(items):
    out = []
    for x in items:
        seen = False
        for y in out:
            if x == y:
                seen = True
                break
        if not seen:
            out.append(x)
    return out


if __name__ == "__main__":
    import sys
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 4000
    data = [i % (n // 2) for i in range(n)]
    print(len(dedupe(data)))
'''

FAST_DEDUPE = '''"""dedupe a list — trivial-domain canary target (C-001-004b corpus)."""


def dedupe(items):
    seen = set()
    out = []
    for x in items:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out


if __name__ == "__main__":
    import sys
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 4000
    data = [i % (n // 2) for i in range(n)]
    print(len(dedupe(data)))
'''

# P-002's change: preserves behaviour, passes tests, but is measurably WORSE on
# the declared metric. This is what the gate must refuse.
REGRESSED_DEDUPE = '''"""dedupe a list — trivial-domain canary target (C-001-004b corpus)."""


def dedupe(items):
    out = []
    for x in items:
        # "defensive" re-scan on every insert — behaviour-identical, slower
        if not any(x == y for y in list(out)):
            out.append(x)
    return out


if __name__ == "__main__":
    import sys
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 4000
    data = [i % (n // 2) for i in range(n)]
    print(len(dedupe(data)))
'''

TEST_DEDUPE = '''from dedupe import dedupe


def main():
    assert dedupe([]) == []
    assert dedupe([1, 1, 1]) == [1]
    assert dedupe([3, 1, 3, 2, 1]) == [3, 1, 2]
    assert dedupe(["a", "b", "a"]) == ["a", "b"]
    print("ok 4 assertions")


main()
'''


class Canary:
    def __init__(self, args):
        self.args = args
        self.repo = os.path.abspath(args.repo)
        self.rr = os.path.abspath(args.run_root)
        self.ws = os.path.join(self.rr, "workspace")
        self.log_path = os.path.join(self.rr, "canary-log.jsonl")
        self.status_path = os.path.join(self.rr, "day-status.json")
        self.record_path = os.path.join(self.rr, "RECORD.md")
        self.bin = os.path.join(self.repo, "agents/cdreview-brainstorm-join/bin")
        self.t0 = time.time()
        self.side_effects = 0
        self.status_writes = 0
        self.violations = []

    # ---------------------------------------------------------------- plumbing
    def log(self, event, **kw):
        rec = {"t": round(time.time() - self.t0, 3), "event": event}
        rec.update(kw)
        with open(self.log_path, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(rec) + "\n")
        print("[%6.2fs] %s %s" % (rec["t"], event,
                                  " ".join("%s=%s" % (k, v) for k, v in kw.items())))

    def write_status(self, step, state="running", **kw):
        """Continuity invariant: status is written BEFORE the side effect."""
        st = {
            "state": state,
            "scope_id": "canary-cycle-1",
            "last_step": step,
            "run_id": "canary-2026-07-30",
            "sealed": True,
            "resume_hint": "resume by re-running canary_driver.py --resume; "
                           "steps at or before last_step are skipped",
            "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        st.update(kw)
        tmp = self.status_path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(st, fh, indent=2)
            fh.write("\n")
        os.replace(tmp, self.status_path)
        self.status_writes += 1

        # Kill hook keyed on the persisted LABEL, not on a STEPS entry. This is
        # what makes sub-state labels (ship_blocked:<pack>, reverted:<pack>)
        # reachable as kill points — the exact class of label that used to break
        # resume. It also fires BEFORE the step's side effect, which is the
        # dangerous ordering the replay semantics exist for.
        if getattr(self.args, "kill_after_status", None) == step:
            self.log("KILLED_BY_ORACLE", status_label=step,
                     note="simulated SIGKILL immediately after status persist, "
                          "before the side effect")
            sys.stdout.flush()
            os._exit(137)

    def read_status(self):
        if not os.path.exists(self.status_path):
            return None
        with open(self.status_path, encoding="utf-8") as fh:
            return json.load(fh)

    def append_record(self, line):
        with open(self.record_path, "a", encoding="utf-8") as fh:
            fh.write(line + "\n")

    def sh(self, cmd, cwd=None, check=True):
        p = subprocess.run(cmd, shell=isinstance(cmd, str), cwd=cwd or self.ws,
                           capture_output=True, text=True)
        if check and p.returncode != 0:
            self.log("command_failed", cmd=str(cmd)[:120], rc=p.returncode,
                     err=p.stderr[:300])
        return p

    def measure(self, hyp, phase, pack=None):
        cmd = [sys.executable, os.path.join(self.bin, "measure.py"),
               "--run-root", self.rr, "--hyp", hyp, "--phase", phase,
               "--metric", "wall_seconds", "--direction", "lower_is_better",
               "--unit", "seconds", "--runs", "3",
               # Baseline SHAs come from the real repo, so the gate's ancestry
               # conjunct is genuinely evaluated rather than skipped. This mirrors
               # a live cycle: measure at HEAD, edit the working tree, ship later.
               "--git-dir", self.repo,
               "--command", "%s %s 4000" % (sys.executable,
                                            os.path.join(self.ws, "dedupe.py"))]
        if pack:
            cmd += ["--pack", pack]
        p = subprocess.run(cmd, capture_output=True, text=True, cwd=self.repo)
        self.log("measure", hyp=hyp, phase=phase, rc=p.returncode,
                 out=p.stdout.strip()[:200])
        return p.returncode == 0

    def delta(self, hyp):
        p = subprocess.run([sys.executable, os.path.join(self.bin, "measure.py"),
                            "--run-root", self.rr, "--hyp", hyp, "--delta"],
                           capture_output=True, text=True, cwd=self.repo)
        self.log("delta", hyp=hyp, rc=p.returncode, out=p.stdout.strip()[:200])
        return p.stdout.strip()

    def gate(self, pack, hyp):
        p = subprocess.run([sys.executable, os.path.join(self.bin, "gate.py"),
                            "--run-root", self.rr, "--pack", pack, "--hyp", hyp,
                            "--repo", self.repo],
                           capture_output=True, text=True, cwd=self.repo)
        verdict = "pass" if p.returncode == 0 else "veto"
        self.log("evidence_gate", pack=pack, verdict=verdict)
        for line in p.stdout.strip().split("\n"):
            if line.strip():
                self.log("gate_conjunct", detail=line.strip()[:160])
        return verdict

    # ------------------------------------------------------------------ waves
    def seed_workspace(self):
        os.makedirs(self.ws, exist_ok=True)
        with open(os.path.join(self.ws, "dedupe.py"), "w") as fh:
            fh.write(SLOW_DEDUPE)
        with open(os.path.join(self.ws, "test_dedupe.py"), "w") as fh:
            fh.write(TEST_DEDUPE)

    def write_audit(self):
        d = os.path.join(self.rr, "audits/slices")
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, "S1.md"), "w") as fh:
            fh.write("""## Slice S1
## Files reviewed
- workspace/dedupe.py

## Findings
### F-S1-001: dedupe rescans the accumulator for every element
- Severity: P2
- Category: perf
- Location: workspace/dedupe.py:5-13
- Evidence: inner `for y in out` loop makes the function O(n^2) in the number of
  distinct items; on 4000 items with 2000 distinct values this is ~8M comparisons.
- Why it hurts north star: the shape hides an accidental quadratic behind
  ordinary-looking code; a reader cannot see the cost.
- Metric: measurable — wall_seconds, command `python3 dedupe.py 4000`
- Sketch:
  - track membership in a set alongside the ordered output list
- Effort: S

### F-S1-002: no guard against unhashable input
- Severity: P3
- Category: clarity
- Location: workspace/dedupe.py:5
- Evidence: a set-based rewrite would raise TypeError on unhashable items where
  the current version does not.
- Why it hurts north star: silent behavioural difference between versions.
- Metric: not-measurable — this is a semantics question, not a quantity.
- Sketch:
  - document the hashability precondition
- Effort: S

## Patterns
- Accidental quadratics hidden by idiomatic-looking loops.

## Recommended hypothesis clusters
- C1: {F-S1-001} membership test
- C2: {F-S1-002} precondition documentation

## Explicit non-issues
- Module has no imports to audit.
""")

    def write_hypotheses(self):
        d = os.path.join(self.rr, "hypotheses")
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, "H-001-engineer-s1.md"), "w") as fh:
            fh.write("""# H-001-engineer-s1
- hypothesis_id: H-001
- addresses: [F-S1-001]
- claim: tracking membership in a set makes dedupe linear in list length
- warrant: set membership is average O(1) in CPython; the ordered output list is
  preserved separately, so behaviour for hashable input is unchanged
- warrant_hash: sha256:canary-h001
- declared_metric: {name: wall_seconds, command: "python3 dedupe.py 4000",
  direction: lower_is_better, unit: seconds}
- riskiest_assumption: inputs are hashable
- change_surface: workspace/dedupe.py
- parent_hypothesis: null
""")
        with open(os.path.join(d, "H-002-skeptic-s1.md"), "w") as fh:
            fh.write("""# H-002-skeptic-s1
- hypothesis_id: H-002
- addresses: [F-S1-001]
- claim: making the membership scan explicit with any() is clearer and no slower
- warrant: any() short-circuits, so the scan cost should be comparable while the
  intent becomes more readable
- warrant_hash: sha256:canary-h002
- declared_metric: {name: wall_seconds, command: "python3 dedupe.py 4000",
  direction: lower_is_better, unit: seconds}
- riskiest_assumption: that any() over a copied list is not slower than the
  hand-rolled loop it replaces
- change_surface: workspace/dedupe.py
- parent_hypothesis: null
""")

    def seed_citation_cache(self):
        """Sealed run: cache is pre-seeded, nothing is fetched (loop-forge §11.1)."""
        d = os.path.join(self.rr, "citations")
        os.makedirs(d, exist_ok=True)
        fetched = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        rec = {"url": "https://wiki.python.org/moin/TimeComplexity",
               "status": 200, "fetched_at": fetched,
               "quote": "set x in s average case O(1)",
               "seeded_by": "epsilon canary (network sealed)"}
        with open(os.path.join(d, "verified.jsonl"), "w") as fh:
            fh.write(json.dumps(rec) + "\n")
        return fetched

    def write_dossiers(self, fetched):
        d = os.path.join(self.rr, "dossiers")
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, "V-001-H-001.md"), "w") as fh:
            fh.write("""# V-001 — H-001
- claim: tracking membership in a set makes dedupe linear in list length
- grounds: CPython set membership is average O(1); the current inner loop is a
  linear scan per element. In-repo ground: workspace/dedupe.py:8 shows the scan.
- warrant: replacing a linear scan with an O(1) membership test reduces the
  per-element cost from O(k) to O(1) for k distinct items seen so far
- qualifier: 0.82
- rebuttal: unhashable inputs would raise where the scan version did not; the
  canary's declared change_surface keeps the ordered-output semantics intact
- backing: https://wiki.python.org/moin/TimeComplexity status: 200 fetched_at: %s
  quote: "set x in s average case O(1)"
- verdict: ADVANCE
- declared_metric: {name: wall_seconds, direction: lower_is_better}
- change_surface: workspace/dedupe.py
""" % fetched)
        with open(os.path.join(d, "V-002-H-002.md"), "w") as fh:
            fh.write("""# V-002 — H-002
- claim: making the membership scan explicit with any() is clearer and no slower
- grounds: any() short-circuits on first match. In-repo ground:
  workspace/dedupe.py:8 is the loop being replaced.
- warrant: a short-circuiting generator should cost about what an explicit
  break-loop costs, so readability is gained for free
- qualifier: 0.55
- rebuttal: any() over `list(out)` copies the accumulator on every element, which
  adds an O(k) allocation per element on top of the scan — the readability win
  may be paid for in time. Wave V could not settle the magnitude by reading
  alone, so the metric decides.
- backing: https://wiki.python.org/moin/TimeComplexity status: 200 fetched_at: %s
  quote: "set x in s average case O(1)"
- verdict: ADVANCE
- declared_metric: {name: wall_seconds, direction: lower_is_better}
- change_surface: workspace/dedupe.py
""" % fetched)

    def write_wave_d(self, pack, l6_severity=None, l6_title=None):
        d = os.path.join(self.rr, "audits/pre-pr")
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, "%s-lens6.md" % pack), "w") as fh:
            fh.write("# Wave D review — %s — lens 6 (Evidence & measurement integrity)\n\n"
                     % pack)
            fh.write("## Findings\n\n")
            if l6_severity:
                fh.write("### D-%s-L6-001: %s\n- Severity: %s\n\n"
                         % (pack, l6_title, l6_severity))
            else:
                fh.write("None. All six checks named and passed.\n\n")
        with open(os.path.join(d, "%s.md" % pack), "w") as fh:
            fh.write("# Wave D consolidated review — %s\n\n" % pack)
            fh.write("## Verdict\naccept_and_ship\n\n")
            fh.write("Lenses run: L1, L2, L3, L4, L6\n\n")
            if l6_severity:
                fh.write("### D-%s-L6-001: %s\n- Severity: %s\n"
                         % (pack, l6_title, l6_severity))

    def run_tests(self):
        p = self.sh([sys.executable, "test_dedupe.py"], check=False)
        ok = p.returncode == 0
        self.log("verify", cmd="python3 test_dedupe.py", green=ok,
                 out=(p.stdout or p.stderr).strip()[:120])
        return ok

    # ------------------------------------------------------------------ driver
    def execute(self, step, resumed_past):
        """Execute one step. Status is ALWAYS written before the side effect."""
        if step in resumed_past:
            self.log("skip_completed", step=step)
            return True

        self.write_status(step)          # <-- before the side effect, always

        if time.time() - self.t0 > self.args.budget_seconds:
            self.log("budget_exhausted", step=step)
            self.write_status(step, state="budget_exhausted")
            return False

        if step == "init":
            # Idempotent: RECORD.md is append-only (§13.2.5), so a replayed init
            # must not write a second header. Defence in depth — even if step
            # resolution ever regresses, the record cannot be corrupted.
            header = "# canary RECORD — cdreview-brainstorm-join"
            existing = ""
            if os.path.exists(self.record_path):
                with open(self.record_path, encoding="utf-8") as fh:
                    existing = fh.read()
            if header not in existing:
                self.append_record(header + "\n")
                self.append_record("## Status\nrunning (sealed canary)\n")
                self.append_record("## Goal this cycle\n"
                                   "trivial-domain corpus C-001-004b: \"dedupe a list\"\n")
                self.append_record("## Done (chronological)\n")
            else:
                self.log("record_header_present", note="not duplicating (append-only)")
        elif step == "cycle_scope_written":
            self.seed_workspace()
        elif step == "stare_decisis_loaded":
            self.log("stare_decisis", prior_refutations=0, note="empty archive on first cycle")
        elif step == "slice_map_resolved":
            with open(os.path.join(self.rr, "slice-aim.md"), "w") as fh:
                fh.write("# Slice aim (canary)\n\nChosen: S1 (the only slice in the "
                         "trivial-domain workspace).\nRejected: none — no prior "
                         "constraints exist on a first cycle.\n")
        elif step == "wave_a_collected":
            self.write_audit()
        elif step == "findings_clustered":
            with open(os.path.join(self.rr, "audits/clusters.md"), "w") as fh:
                fh.write("- C1: {F-S1-001} membership test\n"
                         "- C2: {F-S1-002} precondition documentation\n")
        elif step == "wave_h_collected":
            self.write_hypotheses()
        elif step == "citation_verify":
            self._fetched = self.seed_citation_cache()
            self.write_dossiers(self._fetched)
        elif step == "measure_before:H-001":
            if not self.measure("H-001", "before", "P-001"):
                return False
        elif step == "wave_f_collected:P-001":
            # the ADVANCE fix
            with open(os.path.join(self.ws, "dedupe.py"), "w") as fh:
                fh.write(FAST_DEDUPE)
            d = os.path.join(self.rr, "audits/fixes")
            os.makedirs(d, exist_ok=True)
            with open(os.path.join(d, "P-001.md"), "w") as fh:
                fh.write("# Fix P-001\nStatus: done\nHypothesis: H-001\n"
                         "Change surface: workspace/dedupe.py\n"
                         "Label: optimization (pending measured delta)\n")
        elif step == "verify_done:P-001":
            if not self.run_tests():
                self.log("verify_red", pack="P-001")
                return False
        elif step == "measure_after:P-001":
            if not self.measure("H-001", "after", "P-001"):
                return False
        elif step == "delta_computed:P-001":
            self.delta("H-001")
        elif step == "wave_d_collected:P-001:round_1":
            self.write_wave_d("P-001")
        elif step == "evidence_gate:P-001":
            v = self.gate("P-001", "H-001")
            self.append_record("- evidence_gate:P-001:%s" % v)
            self.write_status("evidence_gate:P-001:%s" % v)
            if v != "pass":
                self.violations.append("P-001 should have passed the gate but was vetoed")
        elif step == "measure_before:H-002":
            # baseline for the second pack, taken from the CURRENT (already fast) tree
            if not self.measure("H-002", "before", "P-002"):
                return False
        elif step == "wave_f_collected:P-002":
            # behaviour-identical but slower — the diff the gate must refuse
            with open(os.path.join(self.ws, "dedupe.py"), "w") as fh:
                fh.write(REGRESSED_DEDUPE)
            d = os.path.join(self.rr, "audits/fixes")
            os.makedirs(d, exist_ok=True)
            with open(os.path.join(d, "P-002.md"), "w") as fh:
                fh.write("# Fix P-002\nStatus: done\nHypothesis: H-002\n"
                         "Change surface: workspace/dedupe.py\n"
                         "Label: improvement (readability)\n")
        elif step == "verify_done:P-002":
            if not self.run_tests():
                self.log("verify_red", pack="P-002")
                return False
        elif step == "measure_after:P-002":
            if not self.measure("H-002", "after", "P-002"):
                return False
        elif step == "delta_computed:P-002":
            self.delta("H-002")
        elif step == "wave_d_collected:P-002:round_1":
            # four lenses liked it; L6 found nothing. The gate is the only thing
            # standing between this diff and main.
            self.write_wave_d("P-002")
        elif step == "evidence_gate:P-002":
            v = self.gate("P-002", "H-002")
            self.append_record("- evidence_gate:P-002:%s" % v)
            # Persist the declared vocabulary entry for BOTH outcomes. The header
            # declares evidence_gate:{PACK_ID}:{pass|veto}, so a veto that jumped
            # straight to ship_blocked would leave that declared label unused —
            # the implementation contradicting its own vocabulary.
            self.write_status("evidence_gate:P-002:%s" % v)
            if v == "veto":
                self.write_status("ship_blocked:P-002:delta_not_regressed")
                # revert the pack (§11.1)
                with open(os.path.join(self.ws, "dedupe.py"), "w") as fh:
                    fh.write(FAST_DEDUPE)
                self.write_status("reverted:P-002")
                self.log("reverted", pack="P-002", note="tree restored to pre-pack state")
                if not self.run_tests():
                    self.violations.append("tree not green after revert of P-002")
            else:
                self.violations.append(
                    "P-002 regressed its declared metric but the gate passed it — "
                    "the loop's central property does not hold")
        elif step == "constraints_written":
            d = os.path.join(self.rr, "synthesis")
            os.makedirs(d, exist_ok=True)
            with open(os.path.join(d, "S-002-constraints.md"), "w") as fh:
                fh.write("# Next-cycle constraints (canary)\n\n"
                         "- MUST_RESPECT C-J-c01: membership tests for dedupe use a set\n"
                         "- MUST_AVOID  C-J-c02: any() over a copied accumulator "
                         "(refuted at gate, P-002)\n"
                         "- MUST_TEST   C-J-c03: whether hashability preconditions "
                         "need documenting (F-S1-002 was not-measurable)\n")
        elif step == "develop_pushed":
            self.side_effects += 1
            self.log("ship_stubbed", note="no real git push — sealed canary")
        elif step == "archive_update_complete":
            arch = os.path.join(self.rr, "archive-preview")
            os.makedirs(arch, exist_ok=True)
            with open(os.path.join(arch, "verified-improvements.jsonl"), "w") as fh:
                fh.write(json.dumps({
                    "id": "VI-canary-H001", "hypothesis_id": "H-001",
                    "warrant_hash": "sha256:canary-h001", "verdict": "ADVANCE",
                    "outcome": "shipped", "gate": {"verdict": "pass"}}) + "\n")
                fh.write(json.dumps({
                    "id": "VI-canary-H002", "hypothesis_id": "H-002",
                    "warrant_hash": "sha256:canary-h002", "verdict": "ADVANCE",
                    "outcome": "refuted_at_gate",
                    "gate": {"verdict": "veto", "failed_conjunct": "delta_not_regressed"},
                    "note": "pre-refuted for future cycles"}) + "\n")
        elif step == "record_finalized":
            self.append_record("\n## Stopped at\nscope_complete — canary finished\n")
            self.append_record("\n## Residual / backlog\n"
                               "- C-J-c03 MUST_TEST carried to next cycle\n")

        # kill oracle: die immediately AFTER persisting this step
        if self.args.kill_at and step == self.args.kill_at:
            self.log("KILLED_BY_ORACLE", step=step,
                     note="simulated SIGKILL; no graceful shutdown")
            sys.stdout.flush()
            os._exit(137)

        return True

    def run(self):
        os.makedirs(self.rr, exist_ok=True)

        resumed_past = set()
        if self.args.resume:
            st = self.read_status()
            if not st:
                print("CANARY FAIL: --resume but no day-status.json to resume from")
                return 1
            raw_last = st["last_step"]
            last = normalize_step(raw_last)
            if last is None:
                # Fail loudly. Silently restarting from init would duplicate
                # RECORD.md content and fabricate undocumented re-measures, which
                # the loop's own L6 lens flags as P1 (EVIDENCE-LENS.md §4).
                self.log("RESUME_VIOLATION", last_step=raw_last,
                         detail="status label maps to no declared step; refusing "
                                "to silently replay the cycle")
                print("CANARY FAIL: last_step %r is not in the declared vocabulary "
                      "and has no known owning step" % raw_last)
                self.write_status(raw_last, state="fatal_blocked",
                                  blocked_reason="unmappable_last_step")
                return 1
            # EXCLUSIVE slice on purpose: the owning step is RE-RUN, not skipped.
            # Status is written *before* the side effect, so a crash mid-effect
            # leaves that step recorded but possibly incomplete. cd-review §8.3.1:
            # "the next wake sees the in-flight step and re-runs it idempotently."
            resumed_past = set(STEPS[:STEPS.index(last)])
            self.log("cold_resume", from_step=raw_last,
                     resolved_owning_step=last,
                     replaying_in_flight_step=last,
                     skipping=len(resumed_past),
                     source="day-status.json + RECORD.md only")
        else:
            for p in (self.log_path, self.status_path, self.record_path):
                if os.path.exists(p):
                    os.remove(p)
            for sub in ("audits", "hypotheses", "dossiers", "measure", "gate",
                        "synthesis", "citations", "workspace", "archive-preview"):
                shutil.rmtree(os.path.join(self.rr, sub), ignore_errors=True)
            self.log("canary_start", sealed=True,
                     domain="dedupe a list (C-001-004b fixed corpus)",
                     budget_seconds=self.args.budget_seconds)

        for step in STEPS:
            if not self.execute(step, resumed_past):
                # Preserve a specific terminal state the step already recorded
                # (e.g. budget_exhausted). Flattening everything to fatal_blocked
                # would erase the timeout-vs-failure distinction, and the two have
                # opposite launcher actions: re-wake vs do-not-retry
                # (cd-review §10.5).
                prior = (self.read_status() or {}).get("state")
                if prior in ("budget_exhausted",):
                    self.log("canary_end", state=prior, step=step,
                             note="specific terminal state preserved")
                    return 1
                self.write_status(step, state="fatal_blocked",
                                  blocked_reason="canary step failed")
                self.log("canary_end", state="fatal_blocked", step=step)
                return 1

        self.write_status("scope_complete", state="complete")
        self.log("canary_end", state="complete",
                 status_writes=self.status_writes,
                 violations=len(self.violations))
        for v in self.violations:
            self.log("PROPERTY_VIOLATION", detail=v)
        return 1 if self.violations else 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default=".")
    ap.add_argument("--run-root", required=True)
    ap.add_argument("--kill-at",
                    help="STEPS entry to die after (post side-effect)")
    ap.add_argument("--kill-after-status",
                    help="persisted status LABEL to die immediately after, before "
                         "the side effect; reaches sub-state labels such as "
                         "reverted:<pack>")
    ap.add_argument("--resume", action="store_true")
    ap.add_argument("--budget-seconds", type=int, default=300)
    sys.exit(Canary(ap.parse_args()).run())


if __name__ == "__main__":
    main()
