# V05 consensus safety/liveness envelope for mode timeout caps — 2026-03-15 06:35 UTC

## Question
How do we calibrate mode-specific aggregate timeout caps without making agent modes too permissive?

## Reading-derived conclusion
Use a **safety-first envelope**: allow mode-specific liveness tuning only if deterministic safety invariants remain unchanged for equivalent evidence tuples.

## Recommended extension
Add `timeoutCapSafetyEnvelope` fields:
- `capSafetyInvariantSatisfied`
- `livenessAllowanceApplied`
- `allowanceDoesNotOverrideSafety`
- `decisionDeterminismFingerprint`

## Deterministic policy
1. Equivalent evidence tuple + same mode must always yield the same exceed/non-exceed decision.
2. Mode-specific liveness allowance may differ across modes, but cannot change safety verdicts for equivalent tuples within a mode.
3. Invariant breach forces fail-closed non-credit classification.

## One-battle acceptance criteria (next verify slice)
- Fixture A: repeated identical tuple in same mode -> identical verdict + identical fingerprint.
- Fixture B: tuple replayed in another mode may differ only according to profile cap, never due to non-deterministic drift.
- Fixture C: injected invariant breach flips `allowanceDoesNotOverrideSafety=false` and forces non-credit reason.

## Caveat
Guidance artifact only; no live on-chain claim.
