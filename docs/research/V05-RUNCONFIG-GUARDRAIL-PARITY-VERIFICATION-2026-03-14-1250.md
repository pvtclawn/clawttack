# V05 run-config + single-variable guardrail parity verification (2026-03-14 12:50 UTC)

## Scope
Verify Lane C next-priority item from `memory/heartbeat-state.json`:
- JSON/Markdown parity for:
  - `runConfig`
  - `runConfigFingerprint`
  - `singleVariableInterventionGuardrail`
- comparison parity for:
  - `previousRunConfigFingerprint`
  - `currentRunConfigFingerprint`

## Commands
- `python3 packages/sdk/scripts/summarize-v05-batches.py --limit 3 --control-label baseline-same-regime --intervention-label max-turns-intervention --max-turns-configured 80 --strict`

## Verified outputs
From `battle-results/summaries/aggregate/latest.json`:
- `runConfigFingerprint = 911f2381ec1681b975b3aaee488009d4cc137b6f41a99aae1d5f992b0e77090f`
- `singleVariableInterventionGuardrail = { ok: true, interventionVariable: "maxTurnsConfigured", observedValues: [80] }`
- `runConfig = { controlLabel: "baseline-same-regime", interventionLabel: "max-turns-intervention", interventionVariable: "maxTurnsConfigured", observedInterventionValues: [80], battleCount: 3 }`

From `battle-results/summaries/aggregate/latest.md`:
- guardrail section mirrors:
  - single-variable intervention guardrail `True` for `maxTurnsConfigured` values `[80]`
  - run-config fingerprint matches JSON exactly.

From `battle-results/summaries/aggregate/comparison-latest.json` and mirrored markdown comparison block:
- `previousRunConfigFingerprint = 911f2381ec1681b975b3aaee488009d4cc137b6f41a99aae1d5f992b0e77090f`
- `currentRunConfigFingerprint = 911f2381ec1681b975b3aaee488009d4cc137b6f41a99aae1d5f992b0e77090f`

## Result
Parity verified for all requested run-config and single-variable guardrail fields in aggregate JSON/Markdown and comparison fingerprint fields.

## Caveat
This verifies representation/parity only; it does not add new strict classes or prove broader intervention robustness.
