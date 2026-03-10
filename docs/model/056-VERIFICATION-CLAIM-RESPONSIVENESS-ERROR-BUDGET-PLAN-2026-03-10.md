# 056 — Verification-Claim Responsiveness Error-Budget Plan (2026-03-10)

## Context
Verification-claim hardening has improved correctness semantics (caveats, triangulation, trace, safety/liveness checks). Remaining gap: no explicit responsiveness SLO/error-budget guard for claim-gate operations.

## Objective
Introduce simulation/tooling gate for verification-claim **responsiveness under load/failure** using SLI/SLO + error budget semantics.

## Task (single, merge-sized)
Add helper in `packages/protocol`:
- Inputs:
  - observation window (N decisions)
  - SLI samples (latencyMs, validDecisionRate, recoveryAttempts)
  - SLO thresholds + allowed error budget
- Deterministic outputs:
  - `claim-responsiveness-pass`
  - `claim-responsiveness-warning`
  - `claim-error-budget-exceeded`

## Acceptance criteria
1. Window within SLO thresholds and error budget -> `claim-responsiveness-pass`.
2. Near-budget burn -> deterministic `claim-responsiveness-warning`.
3. Error budget exceeded -> deterministic `claim-error-budget-exceeded`.
4. Identical input tuple yields deterministic verdict + artifact hash.

## Non-goals
- No production publish-path enforcement in this slice.
- No social automation changes.

## Next Task
Lane F: red-team responsiveness error-budget gate for metric-window gaming, synthetic low-latency spoofing, and warning-suppression strategies.
