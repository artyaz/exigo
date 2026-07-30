# ε kill-and-resume oracle

Killed at a randomly selected `last_step` from the target's **own** declared
vocabulary (C-001-can-04), not cd-review's §10.7 names.

- Declared vocabulary (12 steps): init, surface_manifest_written, bench_both_arms_passed, bridge_probed, mu_dispatched, mu_consolidated, pi_dispatched, pi_registered, delta_authored, epsilon_gated, record_finalized, scope_complete
- Randomly selected kill point: **`bridge_probed`**
- Cold-launcher resume contract present: **yes**
  (`day-status.json.last_step` + `RECORD.md` "Stopped at", declared in §5 and
  invariant §7.3)
- Verdict: **SUCCESS**

Honest scope limit: this is a **structural** oracle. It verifies the authored
protocol *can express* a resume from an arbitrary declared step, and that the
kill point is a legal member of the declared vocabulary. It does **not** execute
a real worker, kill it mid-flight, and observe recovery — that requires a
dispatched target-loop micro-cycle, which this cycle could not afford. Recorded
as a residual, not claimed as a full canary.
