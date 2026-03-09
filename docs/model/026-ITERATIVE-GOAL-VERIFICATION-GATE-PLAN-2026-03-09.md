# 026 — Iterative Goal-Verification Gate Plan (2026-03-09)

Input: `memory/reading-notes/2026-03-09--iterative-goal-verification-as-loop-safety.md`

## Motivation
Guardrail modules are increasingly loop-driven (resync attempts, suspect-state transitions, repeated gate checks). To avoid drift and hidden infinite loops, each iteration should include explicit verification intent and deterministic stop semantics.

## Proposed delta (simulation-only)
Introduce a common iteration contract for guardrail loops:

### Required step outputs
1. `verificationAction` — what was checked this iteration
2. `goalReached` — boolean target status
3. `continueReason` — enum when continuing
4. `stopReason` — enum when halting

### Deterministic halt conditions
- `goalReached=true` => halt success
- `iteration >= maxIterations` => halt bounded fallback
- terminal integrity failure => halt with explicit reject reason

## Candidate initial integration points
- `replay-envelope-verifier` resync attempts
- `dual-clock-timeout` suspect/confirm loop
- `failure-injection` matrix rerun control

## Acceptance criteria
1. **No unbounded loops**: all fixtures halt with explicit reason.
2. **Deterministic halts**: identical fixtures produce identical stopReason and step count.
3. **No premature success**: unresolved states cannot emit `goalReached=true` without required verificationAction evidence.
4. **Trace auditability**: iteration traces include step index + reason code timeline.

## Minimal next task
Implement a pure TypeScript loop-runner helper that enforces the iteration contract and bounded stopping, with fixtures for:
- successful convergence,
- adversarial churn (bounded fallback),
- false-goal signal (must continue).
