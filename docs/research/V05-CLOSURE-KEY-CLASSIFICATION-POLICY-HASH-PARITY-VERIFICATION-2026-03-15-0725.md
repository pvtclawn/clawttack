# V05 closure key-classification policy-hash parity verification — 2026-03-15 07:25 UTC

## Goal
Verify newly added closure key-classification policy-hash hardening across artifact surfaces:
1. policy-hash match case remains non-invalid,
2. policy-hash mismatch emits downgrade hard-invalid as top claim-limiting reason,
3. markdown/json parity and visibility remain aligned.

## Method
- Synthetic temp-harness via `build_per_battle(...)` + `write_markdown(...)`.
- Fixed policy tuple:
  - required: `sourceOfMove.A.kind`, `sourceOfMove.B.kind`
  - optional: `checkpoint.results`
- Two fixtures:
  - **match:** reported hash equals computed expected policy hash
  - **mismatch:** reported hash = `deadbeef`
- Captured match flags, top trigger fields, invalid-tier fields, parity status, and markdown visibility token.

## Captured results
```json
{
  "match": {
    "closurePolicyHashMatch": true,
    "reportedPolicyHash": "<expected>",
    "topHardInvalidTrigger": null,
    "topClaimLimitingReason": "proper-battle-rubric-pending",
    "invalidForProperBattle": false,
    "forcedVerdictTier": null,
    "parityStatus": "aligned",
    "markdownHasClosurePolicyToken": true
  },
  "mismatch": {
    "closurePolicyHashMatch": false,
    "reportedPolicyHash": "deadbeef",
    "topHardInvalidTrigger": "hard-invalid:closure-key-classification-downgrade:expected-...:reported-deadbeef",
    "topClaimLimitingReason": "hard-invalid:closure-key-classification-downgrade:expected-...:reported-deadbeef",
    "invalidForProperBattle": true,
    "forcedVerdictTier": "invalid-for-proper-battle",
    "parityStatus": "aligned",
    "markdownHasClosurePolicyToken": true
  }
}
```

## Verification conclusion
- Match fixture behaves as expected (no downgrade trigger).
- Mismatch fixture deterministically emits `hard-invalid:closure-key-classification-downgrade:*` as top hard-invalid and top claim-limiting reason.
- Governed markdown/json parity remains aligned and markdown surfaces `closurePolicyHashMatch`.

## Caveat
Synthetic artifact-layer verification only; no live on-chain claim in this check.
