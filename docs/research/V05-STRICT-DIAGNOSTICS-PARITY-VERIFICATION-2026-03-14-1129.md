# V05 Strict Diagnostics Parity Verification — 2026-03-14 11:29 UTC

## Scope
Verify JSON/Markdown parity for strict diagnostics fields after adding strict-mode output-boundary semantics in `packages/sdk/scripts/summarize-v05-batches.py`.

## Commands
```bash
python3 packages/sdk/scripts/summarize-v05-batches.py \
  --limit 3 \
  --control-label baseline-same-regime \
  --intervention-label max-turns-control-prep \
  --max-turns-configured 80

python3 packages/sdk/scripts/summarize-v05-batches.py \
  --limit 3 \
  --control-label baseline-same-regime \
  --intervention-label max-turns-control-prep \
  --max-turns-configured 80 \
  --strict
```

## Artifacts inspected
- `battle-results/summaries/aggregate/latest.json`
- `battle-results/summaries/aggregate/latest.md`

## Verified parity (strict diagnostics)
- `strictMode=true` (JSON) ↔ `strict mode: True` (Markdown)
- `strictViolationCount=0` (JSON) ↔ `strict violation count: 0` (Markdown)
- `strictViolations=[]` (JSON) ↔ `strict violations: none` (Markdown)

## Additional guardrail context
- `labelHygieneOk=true`
- `maxTurnsComparable=true`
- `warnings=[]`

## Result
Strict diagnostics contract is parity-stable across machine-readable and human-readable aggregate outputs for this labeled refresh.

## Caveat
This verifies diagnostics parity, not strict-failure behavior under intentionally contaminated inputs. Orthogonal contamination counters / strict violation injection tests remain the next hardening path.
