# V05 compact anti-replay ledger tombstone compaction — guidance (2026-03-15 08:35 UTC)

## Question
How can transition-id anti-replay ledger state stay compact and bounded without weakening one-time consumption guarantees?

## Reading-derived conclusion
Use **transactional tombstone compaction**: compact detail, never replay identity. Durability + atomicity must hold for consumed-key replay guards before and after compaction.

## Recommended extension
Add compact-ledger fields:
- `transitionLedgerState` (`active` | `consumed-tombstone` | `compacted-tombstone`)
- `transitionLedgerCompactionEpoch`
- `transitionLedgerRetentionHorizon`
- `transitionLedgerReplayGuardHash`

## Deterministic policy
1. Consume transition IDs atomically (key, payload hash, state).
2. Compaction may prune payload/history only after replay-guard hash is persisted.
3. Replayed key that matches stored replay-guard identity remains invalid post-compaction.
4. Missing replay-guard identity during compaction => fail-closed.

## One-battle acceptance criteria (next verify slice)
- Fixture A: consumed key before compaction still triggers replay invalid after compaction.
- Fixture B: compaction attempt lacking replay-guard hash fail-closes.
- Fixture C: markdown/json both show compacted state + replay-guard continuity evidence.

## Caveat
Guidance artifact only; no live on-chain claim.
