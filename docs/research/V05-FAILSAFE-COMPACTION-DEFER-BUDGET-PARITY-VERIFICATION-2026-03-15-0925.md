# V05 fail-safe compaction defer-budget parity verification — 2026-03-15 09:25 UTC

## Goal
Verify fail-safe compaction defer-budget hardening across artifact surfaces:
1. below-threshold defer count does not trigger hard-invalid,
2. above-threshold defer count emits `hard-invalid:compaction-failsafe-defer-budget-exhausted:*` as top claim-limiting reason,
3. markdown/json parity remains aligned with visibility token present.

## Method
- Synthetic temp-harness via `build_per_battle(...)` + `write_markdown(...)`.
- Two fixtures under identical battle/evidence tuple:
  - **within:** `deferredCount=3`, `deferBudget=5`
  - **exhausted:** `deferredCount=7`, `deferBudget=5`
- Captured defer-budget fields, top trigger fields, invalid-tier fields, parity status, and markdown token visibility.

## Captured results
```json
{
  "within": {
    "deferBudgetWithinCap": true,
    "topHardInvalidTrigger": null,
    "topClaimLimitingReason": "proper-battle-rubric-pending",
    "invalidForProperBattle": false,
    "forcedVerdictTier": null,
    "parityStatus": "aligned",
    "markdownHasDeferToken": true
  },
  "exhausted": {
    "deferBudgetWithinCap": false,
    "topHardInvalidTrigger": "hard-invalid:compaction-failsafe-defer-budget-exhausted:count-7:budget-5",
    "topClaimLimitingReason": "hard-invalid:compaction-failsafe-defer-budget-exhausted:count-7:budget-5",
    "invalidForProperBattle": true,
    "forcedVerdictTier": "invalid-for-proper-battle",
    "parityStatus": "aligned",
    "markdownHasDeferToken": true
  }
}
```

## Verification conclusion
- Below-threshold fixture behaves as expected (no defer-budget hard-invalid).
- Exhausted fixture deterministically emits defer-budget hard-invalid as top hard-invalid and top claim-limiting reason.
- Governed markdown/json parity remains aligned and markdown surfaces `deferBudgetWithinCap`.

## Caveat
Synthetic artifact-layer verification only; no live on-chain claim in this check.
