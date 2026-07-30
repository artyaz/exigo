# H-001-engineer-s1
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
