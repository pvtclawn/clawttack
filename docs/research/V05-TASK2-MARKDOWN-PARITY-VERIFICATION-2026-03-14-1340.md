# V05 Task 2 Markdown Parity Verification — 2026-03-14 13:40 UTC

## Scope
Verify the latest Task 2 slice (`summarize-v05-batches.py`) for:
1. JSON-first paired-evidence fields,
2. aggregate Markdown parity for those fields,
3. tiny-sample caveat presence,
4. strict clean-path stability.

## Command run
```bash
python3 packages/sdk/scripts/summarize-v05-batches.py \
  --limit 3 \
  --control-label baseline-same-regime \
  --intervention-label max-turns-intervention \
  --max-turns-configured 80 \
  --strict
```

## Verified outputs
From `battle-results/summaries/aggregate/latest.json`:
- `interventionTargetMetrics.pairedEvidenceScope = "interventionTargetMetrics"`
- `interventionTargetMetrics.pairedEvidenceDenominator = "interventionTargetMetrics.battleCount"`
- `interventionTargetMetrics.sampleSize = 3`
- `interventionTargetMetrics.unsettledShare = 1.0`
- `interventionTargetMetrics.firstMoverAShare = 0.3333333333333333`
- `interventionTargetMetrics.exploratoryOnly = true`
- `strictMode = true`
- `strictViolationCount = 0`

From `battle-results/summaries/aggregate/latest.md`:
- includes parity lines for paired-evidence scope/denominator/sample/unsettled/first-mover/exploratory fields,
- includes explicit **tiny-sample caveat** text,
- strict/guardrail section remains coherent.

## Result
Task 2 markdown parity + tiny-sample caveat hardening is verified for strict clean path.

## Caveat
This verifies reporting parity and caveat visibility only; it does not by itself improve settlement coverage or intervention robustness.
