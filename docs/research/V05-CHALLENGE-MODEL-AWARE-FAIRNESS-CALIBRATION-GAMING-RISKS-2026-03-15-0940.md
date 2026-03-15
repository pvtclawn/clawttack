# V05 Challenge — model-aware fairness calibration gaming risks (2026-03-15 09:40 UTC)

## Scope
Red-team model-aware per-key defer fairness calibration for evasion vectors.

## Findings (4 weaknesses)
1. **Active-key inflation via dust-key injection**
   - Mitigation: minimum contribution floor for active-key inclusion.
   - Trigger: `hard-invalid:fairness-active-key-inflation-suspected`.

2. **Evidence-window slicing/reset manipulation**
   - Mitigation: monotonic rolling window + anti-reset guard.
   - Trigger: `hard-invalid:fairness-evidence-window-manipulation`.

3. **Deviation denominator distortion**
   - Mitigation: dual-threshold policy (ratio + absolute defer-count floor).
   - Trigger: `hard-invalid:fairness-denominator-distortion-risk`.

4. **Threshold oscillation camouflage**
   - Mitigation: hysteresis/cumulative dominance score across rolling horizon.
   - Trigger: `hard-invalid:fairness-threshold-oscillation-camouflage`.

## Minimal next implementation slice
1. Active-key contribution floor + dust-key exclusion.
2. Monotonic rolling evidence window guard.
3. Ratio + absolute-count dual-threshold no-trigger requirement.

## Caveat
Design-level challenge artifact only; no live on-chain claim.
