# V05 guardrail contract parity verification (2026-03-14 10:59 UTC)

## Scope
Verify JSON/Markdown parity for the newly added aggregate guardrail contract fields after a labeled summary refresh:
- `labelHygieneOk`
- `maxTurnsComparable`
- `warnings[]`

## Commands run
- `python3 packages/sdk/scripts/summarize-v05-batches.py --limit 3 --control-label baseline-same-regime --intervention-label max-turns-control-prep --max-turns-configured 80`
- `python3 -m py_compile packages/sdk/scripts/summarize-v05-batches.py`

## Artifacts inspected
- `battle-results/summaries/aggregate/latest.json`
- `battle-results/summaries/aggregate/latest.md`

## Verified outputs
From `aggregate/latest.json`:
- `labelHygieneOk = true`
- `maxTurnsComparable = true`
- `warnings = []`

From `aggregate/latest.md` (`## guardrails`):
- `label hygiene ok: True`
- `max turns comparable: True`
- `warnings: none`

## Parity result
Guardrail contract parity is confirmed between machine-readable JSON and human-readable Markdown.

## Additional consistency check
Intervention-target aggregate budget fields remain stable and intervention-scoped:
- `battleCount = 3`
- `turnBudgetRatioDenominator = interventionTargetMetrics.battleCount`
- `turnBudgetUsedCount = 0`
- `turnBudgetUnusedCount = 3`
- `turnBudgetUsedRatio = 0.0`

## On-chain classification
Verified no action needed (local summary-structure verification only).

## Caveat
This lane verifies parity only. It does not yet implement strict-mode fail-fast behavior or deeper contamination counters beyond current warnings/booleans.
