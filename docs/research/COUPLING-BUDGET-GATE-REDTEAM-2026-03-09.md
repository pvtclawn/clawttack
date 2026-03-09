# Guardrail Coupling-Budget Gate — Red-Team Findings (2026-03-09)

Input: `docs/model/034-GUARDRAIL-COUPLING-BUDGET-GATE-PLAN-2026-03-09.md`
Companion critique log: `memory/challenges/2026-03-09--coupling-budget-gate-red-team.md`

## Top exploit risks
1. Snapshot spoofing / partial edge extraction.
2. Waiver abuse as a de facto permanent bypass.
3. Edge under-reporting through indirection patterns.
4. Metric gaming across coupling dimensions.
5. Baseline/tooling drift breaking delta comparability.

## Hardening directions
- Add extraction confidence checks with fail-closed policy.
- Enforce waiver quotas, expiries, and escalation triggers.
- Account for dynamic/indirect coupling edges.
- Gate on multi-axis coupling limits with per-axis reason codes.
- Version-lock baseline/tooling and reject mismatches deterministically.

## Acceptance gates for next implementation slice
1. Low-confidence snapshot extraction cannot pass gate.
2. Waiver overuse triggers deterministic escalation state.
3. Indirection growth is reflected in coupling score.
4. Critical-axis limit breaches fail even if aggregate budget is nominal.
5. Baseline/tooling version mismatch returns deterministic hard fail.
