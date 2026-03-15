# V05 anchor-transition carryover-scope digest parity verification — 2026-03-15 08:25 UTC

## Goal
Verify new carryover-scope digest hardening across artifact surfaces:
1. full-scope digest match case remains non-invalid,
2. partial/forged digest mismatch emits `hard-invalid:anchor-transition-carryover-scope-mismatch:*` as top claim-limiting reason,
3. markdown/json parity and visibility remain aligned.

## Method
- Synthetic temp-harness via `build_per_battle(...)` + `write_markdown(...)`.
- Fixed transition context:
  - `ruleVersion=v2`
  - `battleMode=agent-vs-script`
  - `fromEpoch=10`, `toEpoch=11`
  - carryover manifest: `{lastAcceptedEpoch: 10, lastAcceptedSequence: 77}`
- Two fixtures:
  - **match:** reported digest equals computed full-scope digest
  - **mismatch:** reported digest = `deadbeef`

## Captured results
```json
{
  "match": {
    "carryoverScopeDigestMatch": true,
    "topHardInvalidTrigger": null,
    "topClaimLimitingReason": "proper-battle-rubric-pending",
    "invalidForProperBattle": false,
    "forcedVerdictTier": null,
    "parityStatus": "aligned",
    "markdownHasCarryoverToken": true
  },
  "mismatch": {
    "carryoverScopeDigestMatch": false,
    "topHardInvalidTrigger": "hard-invalid:anchor-transition-carryover-scope-mismatch:expected-...:reported-deadbeef",
    "topClaimLimitingReason": "hard-invalid:anchor-transition-carryover-scope-mismatch:expected-...:reported-deadbeef",
    "invalidForProperBattle": true,
    "forcedVerdictTier": "invalid-for-proper-battle",
    "parityStatus": "aligned",
    "markdownHasCarryoverToken": true
  }
}
```

## Verification conclusion
- Match fixture behaves as expected (no carryover-scope hard-invalid).
- Mismatch fixture deterministically emits `hard-invalid:anchor-transition-carryover-scope-mismatch:*` as top hard-invalid and top claim-limiting reason.
- Governed markdown/json parity remains aligned and markdown surfaces `carryoverScopeDigestMatch`.

## Caveat
Synthetic artifact-layer verification only; no live on-chain claim in this check.
