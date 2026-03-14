# V05 paired-evidence contract parity verification (2026-03-14 13:20 UTC)

## Scope
Verify Lane C target from heartbeat state: strict clean parity for new paired-evidence JSON fields.

## Commands run
- `python3 packages/sdk/scripts/summarize-v05-batches.py --limit 3 --control-label baseline-same-regime --intervention-label max-turns-intervention --max-turns-configured 80 --strict`

## Artifacts inspected
- `battle-results/summaries/aggregate/latest.json`
- `battle-results/summaries/aggregate/latest.md`
- `battle-results/summaries/aggregate/comparison-latest.json`

## Verified exact outputs (aggregate JSON)
- `interventionTargetMetrics.pairedEvidenceScope = "interventionTargetMetrics"`
- `interventionTargetMetrics.pairedEvidenceDenominator = "interventionTargetMetrics.battleCount"`
- `interventionTargetMetrics.sampleSize = 3`
- `interventionTargetMetrics.unsettledShare = 1.0`
- `interventionTargetMetrics.firstMoverAShare = 0.3333333333333333`
- `interventionTargetMetrics.exploratoryOnly = true`

## Guardrail context
- `strictMode = true`
- `strictViolationCount = 0`
- `strictViolations = []`

## Conclusion
Paired-evidence Task 1 JSON contract fields are present and strict-clean for the current labeled run. No on-chain action required (local artifact parity verification only).
