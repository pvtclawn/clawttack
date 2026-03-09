# Iterative Goal-Verification Gate — Red-Team Findings (2026-03-09)

Input: `docs/model/026-ITERATIVE-GOAL-VERIFICATION-GATE-PLAN-2026-03-09.md`
Companion critique log: `memory/challenges/2026-03-09--iterative-goal-verification-gate-red-team.md`

## Top exploit risks
1. Premature-success spoofing without machine-verifiable evidence.
2. Continue-reason gaming to consume loop budget strategically.
3. Stop-reason laundering that hides root failure modes.
4. Bounded-fallback abuse to force favorable halt path.
5. Deterministic-but-incorrect halts due weak predicates.

## Hardening directions
- Require evidence-anchored verification actions and reject unsupported success claims.
- Add repetition/debt controls for low-information continue reasons.
- Enforce stop-reason precedence with evidence-pointer consistency checks.
- Penalize repeated fallback abuse and make abusive fallback outcomes adversary-unfavorable.
- Track correctness metrics in addition to determinism.

## Acceptance gates for next implementation slice
1. Premature-success spoof fixtures fail with deterministic evidence-related reason.
2. Continue-reason repetition policy prevents low-information loop extension.
3. Stop reason + evidence hash consistency is replay-verifiable.
4. Fallback abuse patterns cannot improve attacker EV in simulation.
5. Gate report includes both determinism and correctness scores.
