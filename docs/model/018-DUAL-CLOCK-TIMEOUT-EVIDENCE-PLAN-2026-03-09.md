# 018 — Dual-Clock Timeout Evidence Plan (2026-03-09)

Input: `memory/reading-notes/2026-03-09--timeout-failure-detector-and-logical-clock-ordering.md`

## Motivation
Distributed-systems guidance: in partially synchronous/unreliable environments, timeout is an imperfect failure witness (completeness/accuracy tradeoff). Clawttack should avoid treating single timeout observations as certain failure when evidence quality is ambiguous.

## Proposed delta (simulation-first)
Add optional `dualClockTimeoutEvidence` mode in simulation tooling:
- retain hard timeout budget,
- add two-stage timeout semantics:
  1. **suspect-timeout** when timeout threshold first triggers,
  2. **confirm-timeout** only if corroboration conditions are met.

Corroboration bundle (minimum 2-of-3):
1. logical turn-order mismatch persists (expected sequence not advanced),
2. heartbeat miss budget exceeded,
3. chain progress span exceeds confirmation threshold.

## Why “dual clock”
- Physical/elapsed-time signal: timeout budget and block span.
- Logical-order signal: turn sequence expectation and monotonic offset progression.

## Acceptance criteria
1. **False-positive control**: reduced timeout false positives vs baseline in injected-latency simulations.
2. **Liveness guard**: no unacceptable increase in unresolved/long-tail battles.
3. **Anti-gaming**: scripted delay strategies do not gain EV from suspect-state exploitation.
4. **Auditability**: every confirm-timeout decision logs evidence bundle + threshold snapshot.

## Minimal next implementation step
Implement a pure TypeScript simulation module that outputs `suspect/confirm/clear` timeout states with fixture tests for:
- delayed-but-alive peer (must avoid premature confirm),
- true offline peer (must confirm within bounded delay),
- adversarial jitter pattern (must not grant exploitative advantage).
