# OOD Generalization Gate — Red-Team Findings (2026-03-09)

Input: `docs/model/024-OOD-GENERALIZATION-GATE-PLAN-2026-03-09.md`
Companion critique log: `memory/challenges/2026-03-09--ood-generalization-gate-red-team.md`

## Top exploit risks
1. Holdout leakage through fixture metadata/log signatures.
2. Composite-score metric gaming that hides single-metric regressions.
3. Threshold moving-goalpost governance drift.
4. High-variance gate flips from undersized holdout sets.
5. Overly strict gate suppressing exploratory mechanism innovation.

## Hardening directions
- Rotate holdout fixtures/seeds and redact holdout-specific diagnostics.
- Require per-metric floors in addition to composite gate.
- Freeze/version thresholds per evaluation window.
- Enforce minimum holdout size with confidence intervals.
- Separate exploratory channel from release-candidate promotion gate.

## Acceptance gates for next implementation slice
1. Leakage-audit checklist passes before gate activation.
2. Gate verdict includes metric-wise floor checks + composite result.
3. Threshold changes require version bump and cannot retroactively re-grade runs.
4. Holdout insufficiency returns deterministic `holdout-sample-too-small` verdict.
5. Experimental runs are explicitly labeled non-promotable unless re-evaluated under release gate.
