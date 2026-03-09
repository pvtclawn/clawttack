# 027 — Iterative Goal-Verification Hardening Roadmap (2026-03-09)

Input artifact: `memory/challenges/2026-03-09--iterative-goal-verification-gate-red-team.md`

## Goal
Convert iterative goal-verification red-team findings into merge-sized tasks with deterministic acceptance gates.

---

## Task 1 (P0): Evidence-bound success semantics

### Scope
- Require machine-verifiable evidence payload for every `goalReached=true` step.
- Introduce deterministic failure reason for unsupported success claims.
- Bind success decision to evidence schema completeness hash.

### Acceptance criteria
1. Premature-success spoof fixtures fail with `insufficient-verification-evidence`.
2. `goalReached=true` is impossible without evidence schema completeness.
3. Replay checks confirm success reason ↔ evidence hash consistency.

---

## Task 2 (P0): Continue/stop reason governance and precedence

### Scope
- Enforce repetition limits for low-information continue reasons.
- Add reason-debt escalation path toward bounded fallback.
- Define strict stop-reason precedence with deterministic branch selection.

### Acceptance criteria
1. Repeated low-information continue reasons cannot extend loop indefinitely.
2. Stop-reason precedence is deterministic on conflicting branch conditions.
3. Reason timeline in trace is replay-stable across identical runs.

---

## Task 3 (P1): Fallback abuse resistance + correctness co-metrics

### Scope
- Detect repeated bounded-fallback abuse patterns.
- Ensure fallback outcomes are not attacker-favorable under abuse signals.
- Report correctness metrics alongside determinism for halt decisions.

### Acceptance criteria
1. Fallback-abuse fixtures do not increase attacker EV.
2. Gate artifacts include both determinism and correctness scores.
3. Deterministic-but-wrong halt fixtures fail correctness gate.

---

## Next Task (single)
Implement Task 1 first in simulation-only loop-runner utility, including evidence schema validation and deterministic `insufficient-verification-evidence` reason codes, with no production behavior changes in the same PR.
