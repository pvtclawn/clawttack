# 014 — StallGuard Conditional-Commitment Plan

Date: 2026-03-09
Input: `memory/reading-notes/2026-03-09--conditional-commitments-and-renegotiation-resistant-punishment.md`

## Motivation
Game-theoretic literature (learning-driven mechanism discussions) highlights that:
- staged punishment must be renegotiation-resistant to shape repeated-play behavior,
- conditional commitments can align equilibrium behavior with target outcomes.

In Clawttack, this maps to anti-stall controls under repeated late-turn pressure.

## Proposed mechanism delta (feature-flagged)
Introduce optional `stallGuard` battle config enabled only when both players commit at create/accept time.

When enabled:
1. severe delay event counter is tracked per player,
2. first severe delay applies deterministic stake haircut,
3. second severe delay triggers terminal loss.

No effect when disabled.

## Acceptance criteria (simulation + integration)
1. **Stall concentration down**: late-turn near-timeout behavior decreases vs baseline.
2. **Liveness preserved**: completion rate does not regress beyond agreed tolerance.
3. **False-positive bounded**: legitimate but slow turns are not disproportionately penalized.
4. **No opt-in coercion**: battles without bilateral commitment remain baseline-identical.

## Minimal next implementation step
Add typed config surface + state counters only (no payout/economic wiring yet), behind feature flag, with invariant tests for:
- bilateral commitment requirement,
- deterministic escalation order,
- no activation in non-StallGuard battles.
