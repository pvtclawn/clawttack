# V05 runtime failure subtype mapping verification (2026-03-14 18:35 UTC)

## Scope
Verify Lane B runtime failure subtype mapping slice in `packages/sdk/scripts/summarize-v05-batches.py` using a strict labeled refresh and refreshed summary artifacts.

## Commands run
```bash
python3 packages/sdk/scripts/summarize-v05-batches.py \
  --limit 3 \
  --control-label baseline-same-regime \
  --intervention-label max-turns-120 \
  --max-turns-configured 120 \
  --strict
```

## Artifacts inspected
- `battle-results/summaries/aggregate/latest.json`
- `battle-results/summaries/aggregate/latest.md`
- `battle-results/summaries/per-battle/batch-26-1773512452.json`
- `battle-results/summaries/per-battle/batch-27-1773512894.json`

## Verified outputs
1. Strict/guardrail context remained healthy:
   - `strictMode=true`
   - `strictViolationCount=0`
   - `singleVariableInterventionGuardrail.ok=true`
2. JSON/Markdown parity for aggregate failure histogram is preserved:
   - `failureHistogram={"none":2,"runtime/generic":1}`
3. Per-battle output preserves class+detail split:
   - `failureClass` is normalized (`none` / `runtime/generic`)
   - `failureDetail` retains raw diagnostic text for forensic follow-up.

## Interpretation
- Runtime subtype classifier wiring is active and non-breaking in strict mode.
- This refreshed 3-battle window did not emit one of the newly added explicit runtime subtype signatures (`runtime/turn-construction`, `runtime/submit-estimation`, `runtime/submit-transaction`, `runtime/checkpoint-or-state`), so histogram remains `runtime/generic` for the single failing item.

## Caveat (non-overclaim)
This verifies taxonomy behavior on refreshed artifacts only. It does **not** prove broad subtype coverage until a failing sample matches one of the new runtime subtype signatures.
