# V05 Challenge — timing-aware evidence-tiering gaming risks (2026-03-15 05:10 UTC)

## Scope
Red-team proposed timing-aware evidence-tiering controls for liveness qualification.

## Findings (4 weaknesses)

1. **Freshness-window inflation**
- Risk: oversized window makes stale evidence always look fresh.
- Mitigation: profile-locked window + rule hash binding.
- Trigger: `hard-invalid:timing-window-profile-mismatch`.

2. **Timing-model downgrade laundering**
- Risk: relabeling runs as `unknown/unbounded-delay` to avoid strict freshness obligations.
- Mitigation: derive timing model from run fingerprint; disallow free-form override.
- Trigger: `hard-invalid:timing-model-mismatch`.

3. **Selective source disclosure (stale masking)**
- Risk: omit stale sources from tier breakdown to underreport risk.
- Mitigation: evidence-inventory closure invariant.
- Trigger: `hard-invalid:evidence-inventory-incomplete`.

4. **Clock-skew exploitation**
- Risk: producer/verifier clock drift causes stale evidence to appear fresh.
- Mitigation: freshness check on verifier monotonic time + bounded skew tolerance.
- Trigger: liveness qualification forced false with reason `clock-skew-unsafe`.

## Minimal next implementation slice
1. Profile-locked freshness-window binding + mismatch trigger.
2. Run-fingerprint timing-model binding.
3. Source-inventory closure check.

## Caveat
Design-level red-team artifact only; no on-chain battle claim.
