# Feedback Cadence Budget Gate — Red-Team Findings (2026-03-09)

Input: `docs/model/036-FEEDBACK-CADENCE-BUDGET-GATE-PLAN-2026-03-09.md`
Companion critique log: `memory/challenges/2026-03-09--feedback-cadence-budget-gate-red-team.md`

## Top exploit risks
1. Burst-splitting across windows to evade hard thresholds.
2. Velocity metric spoofing via squash/batching strategies.
3. Warning suppression through near-threshold oscillation.
4. Criticality-weight manipulation by metadata gaming.
5. Fast-but-shallow verification passing cadence without quality.

## Hardening directions
- Add rolling-window burst metrics and anti-splitting checks.
- Use multi-signal velocity estimation with incomplete-signal fail paths.
- Introduce warning debt and escalation over consecutive risky windows.
- Infer criticality independently and audit overrides.
- Couple cadence gate to verification-quality floors.

## Acceptance gates for next implementation slice
1. Rolling-window burst fixtures cannot evade cadence hard fail by splitting commits.
2. Missing velocity telemetry yields deterministic hard fail.
3. Repeated near-threshold windows escalate deterministically.
4. Criticality override anomalies are flagged in verdict artifacts.
5. Cadence pass requires both timing and quality thresholds.
