# V05 Aggregate Turn-Budget Parity Verification — 2026-03-14 10:29 UTC

## Scope
Verify Lane C acceptance for Task 1 from roadmap `147-V05-AGGREGATE-TURN-BUDGET-ACCOUNTING-NEXT-SLICES-2026-03-14.md`:
- aggregate intervention-target used/unused turn-budget accounting exists,
- explicit denominator is present,
- JSON/Markdown parity holds after labeled refresh.

## Commands
```bash
python3 packages/sdk/scripts/summarize-v05-batches.py \
  --limit 3 \
  --control-label baseline-same-regime \
  --intervention-label max-turns-control-prep \
  --max-turns-configured 80
```

## Artifacts checked
- `battle-results/summaries/aggregate/latest.json`
- `battle-results/summaries/aggregate/latest.md`

## Verified fields (`interventionTargetMetrics`)
- `battleCount = 3`
- `turnBudgetRatioDenominator = "interventionTargetMetrics.battleCount"`
- `turnBudgetUsedCount = 0`
- `turnBudgetUnusedCount = 3`
- `turnBudgetUsedRatio = 0.0`

Markdown includes matching denominator and ratio statement:
- `turn-budget used ratio: 0.0 (denominator: interventionTargetMetrics.battleCount)`

## Result
Task 1 acceptance is satisfied for aggregate-field presence and parity.

## Caveat
This verification does **not** yet cover Task 2/Task 3 safeguards:
- comparability + label-hygiene guardrails,
- settled/unsettled co-reporting caveat hardening,
- explicit tiny-sample warning behavior.
