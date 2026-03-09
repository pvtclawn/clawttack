# Context-Growth Budget Gate — Red-Team Findings (2026-03-09)

Input: `docs/model/028-CONTEXT-GROWTH-BUDGET-GATE-PLAN-2026-03-09.md`
Companion critique log: `memory/challenges/2026-03-09--context-growth-budget-gate-red-team.md`

## Top exploit risks
1. Warning-suppression via near-threshold oscillation.
2. Narrated-mode blind-spot exploitation.
3. Threshold manipulation / calibration drift.
4. Budget estimator spoofing / under-reporting.
5. Hard-stop liveness abuse for strategic fallback control.

## Hardening directions
- Add moving-window utilization debt and repeated-near-threshold warnings.
- Keep hard-stop semantics mode-independent with out-of-band alerts.
- Version-lock thresholds per evaluation window with immutable audit trail.
- Attach estimator confidence and conservative fallback accounting for uncertain traces.
- Penalize repeated hard-stop abuse and enforce adversary-unfavorable fallback policy.

## Acceptance gates for next implementation slice
1. Near-threshold oscillation fixtures cannot avoid warnings indefinitely.
2. Raw/narrated mode fixtures produce identical hard-stop decisions.
3. Threshold mutation after run start yields deterministic version-mismatch failure.
4. Low-confidence estimate fixtures trigger conservative budget accounting.
5. Hard-stop abuse fixtures do not improve attacker EV in simulation.
