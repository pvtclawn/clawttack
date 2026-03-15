# V05 safety-envelope fingerprint version-mismatch parity verification — 2026-03-15 06:55 UTC

## Goal
Verify new safety-envelope fingerprint version/hash binding behavior across artifact surfaces:
1. matching computed/reported fingerprint does not trigger hard-invalid,
2. mismatch triggers `hard-invalid:safety-envelope-fingerprint-version-mismatch:*` and becomes top claim-limiting reason,
3. markdown/json parity remains aligned and fingerprint visibility is present.

## Method
- Ran synthetic temp-harness through `build_per_battle(...)` + `write_markdown(...)`.
- Two fixtures with identical evidence tuple/rule inputs:
  - **match:** reported fingerprint equals computed canonical fingerprint
  - **mismatch:** reported fingerprint set to `deadbeef`
- Captured: fingerprint-match flag, top trigger, claim-limiting reason, invalid tier flags, parity status, and markdown fingerprint token visibility.

## Captured results
```json
{
  "match": {
    "fingerprintVersionMatch": true,
    "topHardInvalidTrigger": null,
    "topClaimLimitingReason": "proper-battle-rubric-pending",
    "invalidForProperBattle": false,
    "forcedVerdictTier": null,
    "parityStatus": "aligned",
    "markdownHasFingerprintToken": true
  },
  "mismatch": {
    "fingerprintVersionMatch": false,
    "topHardInvalidTrigger": "hard-invalid:safety-envelope-fingerprint-version-mismatch:rule-v1:rule-abc:computed-...:reported-deadbeef",
    "topClaimLimitingReason": "hard-invalid:safety-envelope-fingerprint-version-mismatch:rule-v1:rule-abc:computed-...:reported-deadbeef",
    "invalidForProperBattle": true,
    "forcedVerdictTier": "invalid-for-proper-battle",
    "parityStatus": "aligned",
    "markdownHasFingerprintToken": true
  }
}
```

## Verification conclusion
- Match fixture behaves as expected (no fingerprint-mismatch hard-invalid).
- Mismatch fixture deterministically emits the new hard-invalid trigger and promotes it to top claim-limiting reason.
- Governed markdown/json parity remains aligned and fingerprint visibility is present in markdown.

## Caveat
Synthetic artifact-layer verification only; no live on-chain claim in this check.
