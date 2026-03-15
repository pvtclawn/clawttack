# V05 Challenge — timeout-subtype partitioned allowance gaming risks (2026-03-15 06:10 UTC)

## Scope
Red-team per-subtype timeout allowance design for exploitable policy-compliant bypasses.

## Findings (4 weaknesses)
1. **Subtype label-flipping through ambiguous timeout wording**
   - Mitigation: ambiguity detector + strict fallback subtype classification.
   - Trigger: `hard-invalid:timeout-subtype-ambiguity`.

2. **Budget-fragmentation via synthetic subtype churn**
   - Mitigation: aggregate timeout allowance cap across all subtype partitions.
   - Trigger: `hard-invalid:timeout-allowance-aggregate-exceeded`.

3. **Hotspot evasion via oscillation around static threshold**
   - Mitigation: rolling-window hotspot score with hysteresis/cooldown.
   - Trigger: `hard-invalid:timeout-hotspot-oscillation`.

4. **Cross-run reset abuse**
   - Mitigation: epoch/session-scoped allowance accounting + lineage binding.
   - Trigger: `hard-invalid:timeout-allowance-reset-abuse`.

## Minimal next implementation slice
1. Aggregate allowance cap across subtype partitions.
2. Ambiguity detector + strict fallback subtype.
3. Rolling hotspot hysteresis check.

## Caveat
Design-level challenge artifact only; no on-chain claim.
