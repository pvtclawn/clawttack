# V05 migration anchor trusted-source parity verification — 2026-03-15 07:55 UTC

## Goal
Verify strict-anchor trusted-source hardening across artifact surfaces:
1. trusted verifier source does not trigger hard-invalid,
2. untrusted producer source triggers `hard-invalid:migration-expiry-anchor-untrusted-source:*` as top claim-limiting reason,
3. markdown/json parity remains aligned with visibility token present.

## Method
- Synthetic temp-harness via `build_per_battle(...)` + `write_markdown(...)`.
- Two fixtures with identical battle/evidence tuples; only migration anchor source differs:
  - **trusted:** `policyMigrationEvaluationAnchorSource=verifier-signed`
  - **untrusted:** `policyMigrationEvaluationAnchorSource=producer`
- Both fixtures run in `policyMigrationEvaluationMode=strict-anchor`.

## Captured results
```json
{
  "trusted": {
    "migrationAnchorSourceTrusted": true,
    "topHardInvalidTrigger": null,
    "topClaimLimitingReason": "proper-battle-rubric-pending",
    "invalidForProperBattle": false,
    "forcedVerdictTier": null,
    "parityStatus": "aligned",
    "markdownHasAnchorTrustToken": true
  },
  "untrusted": {
    "migrationAnchorSourceTrusted": false,
    "topHardInvalidTrigger": "hard-invalid:migration-expiry-anchor-untrusted-source:mode-strict-anchor:source-producer",
    "topClaimLimitingReason": "hard-invalid:migration-expiry-anchor-untrusted-source:mode-strict-anchor:source-producer",
    "invalidForProperBattle": true,
    "forcedVerdictTier": "invalid-for-proper-battle",
    "parityStatus": "aligned",
    "markdownHasAnchorTrustToken": true
  }
}
```

## Verification conclusion
- Trusted strict-anchor source behaves as expected (no untrusted-source hard-invalid).
- Untrusted strict-anchor source deterministically emits the new hard-invalid trigger and promotes it to top claim-limiting reason.
- Governed markdown/json parity remains aligned and markdown surfaces `migrationAnchorSourceTrusted`.

## Caveat
Synthetic artifact-layer verification only; no live on-chain claim in this check.
