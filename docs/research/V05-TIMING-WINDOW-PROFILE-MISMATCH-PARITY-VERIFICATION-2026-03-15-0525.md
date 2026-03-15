# V05 timing-window profile mismatch parity verification — 2026-03-15 05:25 UTC

## Goal
Verify new timing-window profile binding behavior across artifact surfaces:
1. profile-match case stays non-invalid,
2. profile-mismatch case emits the hard-invalid trigger and becomes top claim-limiting reason,
3. markdown/json parity remains aligned.

## Method
- Used synthetic temp-harness runs through `build_per_battle(...)` and `write_markdown(...)`.
- Two fixtures (all else equal):
  - **match:** `authenticityFreshnessWindowMsProfile=300000`, `evidenceFreshnessWindowMs=300000`
  - **mismatch:** `authenticityFreshnessWindowMsProfile=300000`, `evidenceFreshnessWindowMs=900000`
- For each fixture, captured:
  - `freshnessWindowProfileMatch`
  - top hard-invalid / top claim-limiting reason
  - invalid-tier flags
  - governed parity status
  - markdown visibility of model-quality line + window-match token

## Captured results
```json
{
  "match": {
    "freshnessWindowProfileMatch": true,
    "topHardInvalidTrigger": null,
    "topClaimLimitingReason": "proper-battle-rubric-pending",
    "invalidForProperBattle": false,
    "forcedVerdictTier": null,
    "parityStatus": "aligned",
    "markdownHasModelQualityLine": true,
    "markdownIncludesWindowMatchToken": true
  },
  "mismatch": {
    "freshnessWindowProfileMatch": false,
    "topHardInvalidTrigger": "hard-invalid:timing-window-profile-mismatch:expected-300000:got-900000",
    "topClaimLimitingReason": "hard-invalid:timing-window-profile-mismatch:expected-300000:got-900000",
    "invalidForProperBattle": true,
    "forcedVerdictTier": "invalid-for-proper-battle",
    "parityStatus": "aligned",
    "markdownHasModelQualityLine": true,
    "markdownIncludesWindowMatchToken": true
  }
}
```

## Verification conclusion
- Match fixture behaves as expected (no hard-invalid trigger).
- Mismatch fixture deterministically surfaces the new timing-window hard-invalid trigger and promotes it to top claim-limiting reason.
- Governed block parity remained aligned across markdown/json after this hardening slice.

## Caveat
Synthetic artifact-layer verification only; no live on-chain battle claim in this check.
