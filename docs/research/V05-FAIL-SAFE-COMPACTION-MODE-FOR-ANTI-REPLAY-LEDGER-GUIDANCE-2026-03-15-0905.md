# V05 fail-safe compaction mode for anti-replay ledger — guidance (2026-03-15 09:05 UTC)

## Question
How do we keep transactional compaction-swap markers compact and replay-resistant under high compaction frequency?

## Reading-derived conclusion
Adopt a **fail-safe compaction mode**: when safety integrity checks are uncertain, prefer compaction deferral (liveness cost) over risky progression (safety loss).

## Recommended extension
Add deterministic compaction safety controls:
- `transitionLedgerCompactionMode` (`fail-safe` | `best-effort`)
- `transitionLedgerCompactionBackpressure`
- `transitionLedgerCompactionSafetyGateSatisfied`
- `transitionLedgerCompactionDeferredCount`

## Deterministic policy
1. Default mode `fail-safe`.
2. If safety gate fails (replay-guard invariant or swap-marker integrity mismatch), do not compact that record.
3. Mark backpressure/deferred count explicitly.
4. Resume compaction only when safety gate is satisfied.

## One-battle acceptance criteria (next verify slice)
- Fixture A: high-frequency compaction with failed safety gate defers compaction and preserves replay identity.
- Fixture B: deferred case sets `transitionLedgerCompactionBackpressure=true` and deterministic defer reason.
- Fixture C: same record compacts successfully once safety gate becomes valid, with replay-guard continuity intact.

## Caveat
Guidance artifact only; no live on-chain claim.
