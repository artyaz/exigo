# H-002-skeptic-s1
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
