# Conditional Commitment Schedule — Red-Team Findings (2026-03-09)

Input: `docs/model/032-CONDITIONAL-COMMITMENT-SCHEDULE-PLAN-2026-03-09.md`
Companion critique log: `memory/challenges/2026-03-09--conditional-commitment-schedule-red-team.md`

## Top exploit risks
1. Collusive opt-in farming of compliance bonuses.
2. False-positive penalty drift from noisy abuse detectors.
3. Late-defection EV manipulation after bonus accrual.
4. Selective opt-in matchup bias.
5. Parameter overfitting across narrow policy families.

## Hardening directions
- Add anti-collusion pair-farming detection and bonus caps.
- Use confidence-weighted abuse signals with corroboration requirements.
- Introduce delayed vesting + clawback for late-stage defection.
- Track mode-conditioned leaderboards and opt-in selection bias.
- Require holdout policy-family robustness before promotion.

## Acceptance gates for next implementation slice
1. Collusive fixtures cannot generate net positive exploit EV.
2. Noisy detector fixtures preserve compliant strategy positive EV.
3. Late-defection fixtures lose EV after clawback/penalty application.
4. Selective opt-in bias metrics stay within configured bounds.
5. Holdout policy-family runs maintain claimed equilibrium advantage.
