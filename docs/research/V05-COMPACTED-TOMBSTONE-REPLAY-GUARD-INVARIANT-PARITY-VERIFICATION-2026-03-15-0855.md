# V05 compacted-tombstone replay-guard invariant parity verification — 2026-03-15 08:55 UTC

## Goal
Verify compacted-tombstone replay-guard invariant behavior across artifact surfaces:
1. compacted tombstone with replay-guard hash remains non-invalid,
2. compacted tombstone missing replay-guard hash emits `hard-invalid:transition-ledger-compaction-replay-guard-missing:*` as top claim-limiting reason,
3. markdown/json parity remains aligned with visibility token present.

## Method
- Synthetic temp-harness via `build_per_battle(...)` + `write_markdown(...)`.
- Two fixtures under identical battle/evidence tuple:
  - **present:** `transitionLedgerState=compacted-tombstone`, `transitionLedgerReplayGuardHash=0xabc123`
  - **missing:** `transitionLedgerState=compacted-tombstone`, replay-guard hash omitted
- Captured replay-guard invariant status, top trigger fields, invalid-tier fields, parity status, and markdown token visibility.

## Captured results
```json
{
  "present": {
    "replayGuardRequired": true,
    "replayGuardInvariantSatisfied": true,
    "topHardInvalidTrigger": null,
    "topClaimLimitingReason": "proper-battle-rubric-pending",
    "invalidForProperBattle": false,
    "forcedVerdictTier": null,
    "parityStatus": "aligned",
    "markdownHasReplayGuardToken": true
  },
  "missing": {
    "replayGuardRequired": true,
    "replayGuardInvariantSatisfied": false,
    "topHardInvalidTrigger": "hard-invalid:transition-ledger-compaction-replay-guard-missing:state-compacted-tombstone:hash-None",
    "topClaimLimitingReason": "hard-invalid:transition-ledger-compaction-replay-guard-missing:state-compacted-tombstone:hash-None",
    "invalidForProperBattle": true,
    "forcedVerdictTier": "invalid-for-proper-battle",
    "parityStatus": "aligned",
    "markdownHasReplayGuardToken": true
  }
}
```

## Verification conclusion
- Guard-present fixture behaves as expected (no missing-guard hard-invalid).
- Guard-missing fixture deterministically emits missing-guard hard-invalid as top hard-invalid and top claim-limiting reason.
- Governed markdown/json parity remains aligned and markdown surfaces `replayGuardInvariantSatisfied`.

## Caveat
Synthetic artifact-layer verification only; no live on-chain claim in this check.
