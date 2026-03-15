# V05 timeout allowance aggregate-cap parity verification — 2026-03-15 06:25 UTC

## Goal
Verify new aggregate timeout-allowance hardening across artifact surfaces:
1. within-cap case stays non-invalid,
2. exceed-cap case emits aggregate-cap hard-invalid as top claim-limiting reason,
3. markdown/json parity remains aligned with new visibility line.

## Method
- Synthetic temp-harness execution through `build_per_battle(...)` and `write_markdown(...)`.
- Two fixtures with identical battle payload except aggregate timeout allowance maps:
  - **match:** budget=12, used=8 (within cap)
  - **exceed:** budget=10, used=13 (over cap)
- Captured:
  - aggregate budget/used fields,
  - `aggregateAllowanceWithinCap`,
  - top hard-invalid / top claim-limiting reason,
  - invalid tier flags,
  - parity status,
  - markdown aggregate-line visibility.

## Captured results
```json
{
  "match": {
    "aggregateBudget": 12,
    "aggregateUsed": 8,
    "aggregateAllowanceWithinCap": true,
    "topHardInvalidTrigger": null,
    "topClaimLimitingReason": "proper-battle-rubric-pending",
    "invalidForProperBattle": false,
    "forcedVerdictTier": null,
    "parityStatus": "aligned",
    "markdownHasAggregateLine": true
  },
  "exceed": {
    "aggregateBudget": 10,
    "aggregateUsed": 13,
    "aggregateAllowanceWithinCap": false,
    "topHardInvalidTrigger": "hard-invalid:timeout-allowance-aggregate-exceeded:budget-10:used-13",
    "topClaimLimitingReason": "hard-invalid:timeout-allowance-aggregate-exceeded:budget-10:used-13",
    "invalidForProperBattle": true,
    "forcedVerdictTier": "invalid-for-proper-battle",
    "parityStatus": "aligned",
    "markdownHasAggregateLine": true
  }
}
```

## Verification conclusion
- Within-cap fixture behaves as expected (no aggregate hard-invalid).
- Exceed-cap fixture deterministically triggers aggregate-cap hard-invalid and promotes it to top claim-limiting reason.
- Governed markdown/json parity remains aligned and markdown surfaces the aggregate allowance line.

## Caveat
Synthetic artifact-layer verification only; no live on-chain claim in this check.
