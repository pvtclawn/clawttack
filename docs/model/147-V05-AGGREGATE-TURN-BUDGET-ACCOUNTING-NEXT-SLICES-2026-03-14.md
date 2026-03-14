# 147 — V05 Aggregate Turn-Budget Accounting Next Slices (2026-03-14)

## Context
Task 1 (canonical per-battle turn-budget fields) is done.
Current blocker: aggregate accounting can still be misread without denominator/comparability guards and tiny-sample caveats.

## Task 1 (next) — Aggregate used/unused accounting with explicit denominator
Implement aggregate turn-budget usage fields under `interventionTargetMetrics`:
- `turnBudgetUsedCount`
- `turnBudgetUnusedCount`
- `turnBudgetUsedRatio`
- `turnBudgetRatioDenominator`

### Acceptance criteria
1. Ratio denominator is explicit and machine-readable (not implied from total battles).
2. Ratio is computed only from intervention-scoped eligible battles.
3. Aggregate JSON + Markdown both show the same count/ratio values.

## Task 2 — Comparability + hygiene guardrails
Add aggregate guardrails to prevent bad cross-run interpretation:
- `maxTurnsComparable` boolean (all included battles share the same configured max turns)
- `labelHygieneOk` boolean (control/intervention labels present and non-empty)
- warning list for violations.

### Acceptance criteria
1. Mixed `maxTurnsConfigured` values force `maxTurnsComparable=false` and emit warning.
2. Missing/blank labels force `labelHygieneOk=false` and emit warning.
3. Warnings are visible in JSON and Markdown aggregate outputs.

## Task 3 — Settled-context + tiny-sample caveat in aggregate summary
Co-report settlement context beside budget metrics:
- `settledBattleCount`
- `unsettledBattleCount`
- markdown caveat line when denominator is small.

### Acceptance criteria
1. Budget-use summary is always displayed alongside settled/unsettled counts.
2. Markdown includes an explicit tiny-sample caveat when denominator < 10.
3. Caveat text avoids overclaiming and frames output as exploratory.

## Priority
1) Task 1, 2) Task 2, 3) Task 3.

## Why this order
Task 1 removes denominator ambiguity first. Task 2 prevents contaminated comparisons. Task 3 improves interpretation discipline after the metrics are structurally sound.
