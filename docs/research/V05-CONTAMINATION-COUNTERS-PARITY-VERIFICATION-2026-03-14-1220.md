# V05 contamination counters + strict-ordering parity verification (2026-03-14 12:20 UTC)

## Scope
Verify JSON/Markdown parity for newly added `contaminationCounters` and deterministic strict warning/violation ordering under:
1. clean labeled strict run,
2. injected label-collapse strict run,
3. multi-class strict-injection harness.

## Commands run
```bash
python3 packages/sdk/scripts/summarize-v05-batches.py \
  --limit 3 \
  --control-label baseline-same-regime \
  --intervention-label max-turns-control-prep \
  --max-turns-configured 80 \
  --strict

python3 packages/sdk/scripts/summarize-v05-batches.py \
  --limit 2 \
  --control-label same-label \
  --intervention-label same-label \
  --max-turns-configured 80 \
  --strict

python3 packages/sdk/scripts/summarize-v05-batches.py --self-test-strict-injections
```

## Verified outputs
### Clean strict run
- `labelHygieneOk=true`
- `maxTurnsComparable=true`
- `warnings=[]`
- `strictMode=true`
- `strictViolationCount=0`
- `strictViolations=[]`
- `contaminationCounters`:
  - `labelControlBlankCount=0`
  - `labelInterventionBlankCount=0`
  - `labelCollapseCount=0`
  - `maxTurnsMismatchCount=0`

### Injected label-collapse strict run
- `labelHygieneOk=false`
- `maxTurnsComparable=true`
- `warnings=["label-hygiene: control and intervention labels collapse to same normalized value"]`
- `strictMode=true`
- `strictViolationCount=1`
- `strictViolations=["label-hygiene: control and intervention labels collapse to same normalized value"]`
- `contaminationCounters`:
  - `labelControlBlankCount=0`
  - `labelInterventionBlankCount=0`
  - `labelCollapseCount=1`
  - `maxTurnsMismatchCount=0`

### Strict-injection harness (deterministic set checks)
- `label-collapse`: expected==actual, `strictViolationCount=1`
- `max-turns-mismatch`: expected==actual, `strictViolationCount=1`
- `combined`: expected==actual, `strictViolationCount=2`
- harness status: `ok`

## JSON/Markdown parity
Aggregate markdown (`battle-results/summaries/aggregate/latest.md`) mirrors strict/guardrail state for both clean and injected runs:
- strict mode,
- strict violation count,
- strict violations,
- label hygiene status,
- max-turn comparability,
- warnings.

## Conclusion
Task verified: contamination counters and strict warning/violation ordering are behaving deterministically and remain parity-stable across JSON and Markdown for clean + injected paths.

## Caveat
Coverage remains scoped to currently implemented contamination classes (`label-collapse`, `max-turns-mismatch`, combined). Broader contamination classes are not yet covered.