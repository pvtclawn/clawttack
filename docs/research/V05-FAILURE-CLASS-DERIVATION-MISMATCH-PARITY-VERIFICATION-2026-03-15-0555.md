# V05 failure-class derivation mismatch parity verification — 2026-03-15 05:55 UTC

## Goal
Verify the new failure-class derivation mismatch hard-invalid behavior and artifact parity:
1. derived==reported case does not emit derivation-mismatch trigger,
2. derived!=reported case emits derivation-mismatch trigger as top claim-limiting reason,
3. markdown/json parity remains aligned.

## Method
- Synthetic temp-harness execution through `build_per_battle(...)` and `write_markdown(...)`.
- Two fixtures with identical error context (`timed out waiting for gateway response`) and identical source-of-move evidence; only reported failure class differs:
  - **match:** `reportedFailureClass=runtime/generic`
  - **mismatch:** `reportedFailureClass=none`
- Captured derived/report values, top triggers, forced tier flags, governed parity status, and markdown visibility markers.

## Captured results
```json
{
  "match": {
    "failureClassDerived": "runtime/generic",
    "reportedFailureClass": "runtime/generic",
    "topHardInvalidTrigger": "hard-invalid:severe-execution-ambiguity:timeout",
    "topClaimLimitingReason": "hard-invalid:severe-execution-ambiguity:timeout",
    "invalidForProperBattle": true,
    "forcedVerdictTier": "invalid-for-proper-battle",
    "parityStatus": "aligned"
  },
  "mismatch": {
    "failureClassDerived": "runtime/generic",
    "reportedFailureClass": "none",
    "topHardInvalidTrigger": "hard-invalid:failure-class-derivation-mismatch:derived-runtime/generic:reported-none",
    "topClaimLimitingReason": "hard-invalid:failure-class-derivation-mismatch:derived-runtime/generic:reported-none",
    "invalidForProperBattle": true,
    "forcedVerdictTier": "invalid-for-proper-battle",
    "parityStatus": "aligned"
  }
}
```

## Verification conclusion
- Mismatch behavior is deterministic and correctly promoted to top claim-limiting reason when present.
- Match fixture confirms no derivation-mismatch override trigger.
- Governed-block markdown/json parity remains aligned after this hardening slice.

## Caveat
Synthetic artifact-layer verification only; no on-chain claim in this check.
