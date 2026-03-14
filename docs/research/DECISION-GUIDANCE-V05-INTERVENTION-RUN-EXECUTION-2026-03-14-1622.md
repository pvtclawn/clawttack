# Decision Guidance — v05 intervention run execution (2026-03-14 16:22)

## Decision
Run a **single-variable intervention** batch now with strict-mode artifact generation enabled.

## Execution contract
- Keep control/intervention labels explicit.
- Change only intervention variable: `maxTurnsConfigured` (set to 120 for this run).
- Keep strict mode on for summary generation.
- Preserve paired evidence fields (`sampleSize`, `unsettledShare`, `firstMoverAShare`, `exploratoryOnly`).
- Keep tiny-sample framing explicit (exploratory only; no broad gameplay claims).

## Run executed
- Batch command:
  - `CLAWTTACK_BATCH_BATTLES=1 CLAWTTACK_MAX_TURNS=120 python3 packages/sdk/scripts/batch-battles.py`
- Summary refresh command:
  - `python3 packages/sdk/scripts/summarize-v05-batches.py --limit 3 --control-label baseline-same-regime --intervention-label max-turns-120 --max-turns-configured 120 --strict`

## Immediate readout (latest aggregate)
- `strictViolationCount=0`
- `singleVariableInterventionGuardrail.ok=true`
- `runConfigFingerprint=f13d0be738401da31a7750fc6557fa675530b90b992fc9e6f902af74bed44962`
- `stageHistogram={"multi-turn":2,"unknown":1}`
- `failureHistogram` includes one `pendingVopB()` decode failure and one object-logged runtime error.
- `unsettledShare=1.0`, `settlementObservedCount=0`, `exploratoryOnly=true`

## Caveat
This run strengthens intervention-path observability but still does not justify settlement-reliability claims.
