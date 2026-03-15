# V05 timeout-subtype partitioned allowance guidance — 2026-03-15 06:05 UTC

## Question
How can timeout subtype precision improve allowance safety without becoming over-permissive?

## Reading-derived conclusion
Use partitioned allowance budgets per timeout subtype (connect / response / retry-budget / generic), not a pooled global timeout allowance. This mirrors partitioning principles: uneven demand can create hotspots that hide risk if all traffic shares one bucket.

## Recommended model extension
Add deterministic per-subtype allowance fields:
- `timeoutSubtypeAllowanceBudget`
- `timeoutSubtypeAllowanceUsed`
- `timeoutSubtypeAllowanceRemaining`
- `allowancePartitionHotspot`

## Deterministic policy
1. No cross-subtype borrowing.
2. Each subtype has fixed cap per profile.
3. `allowancePartitionHotspot=true` when one subtype consumes > configured share threshold.
4. Hotspot sets stricter liveness caveat even before hard cap breach.

## One-battle acceptance criteria (next verify slice)
- Fixture A: repeated `runtime/timeout-response` consumes only response partition.
- Fixture B: connect timeout retains its own budget when response partition is exhausted.
- Fixture C: hotspot condition is emitted deterministically in markdown/json.

## Caveat
Guidance artifact only; no live on-chain claim.
