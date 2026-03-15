# V05 Challenge — tombstone compaction replay-resurrection risks (2026-03-15 08:40 UTC)

## Scope
Red-team anti-replay ledger tombstone compaction for replay-resurrection bypasses.

## Findings (4 weaknesses)
1. **Replay-guard hash elision in compacted tombstones**
   - Mitigation: require replay-guard hash invariant for compacted state.
   - Trigger: `hard-invalid:transition-ledger-compaction-replay-guard-missing`.

2. **Premature tombstone eviction (retention underflow)**
   - Mitigation: enforce minimum retention floor by rule/profile.
   - Trigger: `hard-invalid:transition-ledger-retention-underflow`.

3. **Non-atomic compaction swap race**
   - Mitigation: transactional replace semantics for consumed→compacted tombstone transition.
   - Trigger: `hard-invalid:transition-ledger-compaction-atomicity-breach`.

4. **Replay-guard collision laundering via weak preimage binding**
   - Mitigation: full canonical preimage binding with strong hash.
   - Trigger: `hard-invalid:transition-ledger-replay-guard-collision-risk`.

## Minimal next implementation slice
1. Mandatory replay-guard hash invariant.
2. Transactional compaction swap enforcement.
3. Retention-floor fail-closed check.

## Caveat
Design-level challenge artifact only; no live on-chain claim.
