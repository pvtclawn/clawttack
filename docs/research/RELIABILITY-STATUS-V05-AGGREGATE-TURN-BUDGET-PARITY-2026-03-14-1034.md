# Reliability Status — v05 aggregate turn-budget parity (2026-03-14 10:34 UTC)

## Scope
Synthesize the latest Lane C verification for aggregate intervention-target turn-budget accounting parity.

## Verified now
1. Aggregate intervention-target turn-budget fields are present and parity-checked across JSON + Markdown outputs.
2. Denominator semantics are explicit and intervention-scoped (`turnBudgetRatioDenominator=interventionTargetMetrics.battleCount`).
3. Current labeled refresh remains internally consistent for the latest sample (`battleCount=3`, `turnBudgetUsedCount=0`, `turnBudgetUnusedCount=3`, `turnBudgetUsedRatio=0.0`).

## Reliability claim (narrow, evidence-backed)
The summary layer now reliably reports aggregate used-vs-unused turn-budget accounting for intervention-target metrics with explicit denominator semantics, and this parity has been verified on current artifacts.

## Remaining safeguards (still pending)
1. Add comparability guardrails (`maxTurnsComparable`) for mixed-turn-cap runs.
2. Add label-hygiene guardrails (`labelHygieneOk` + warnings) for stale/missing labels.
3. Add explicit tiny-sample caveat hardening in aggregate markdown output.

## Decision
No on-chain action is justified for this slice (local observability/reliability synthesis only).

## Next recommended slice
Implement guardrails + caveat hardening (Task 2/3 in roadmap `147-V05-AGGREGATE-TURN-BUDGET-ACCOUNTING-NEXT-SLICES-2026-03-14.md`) before using these metrics for stronger intervention inference.
