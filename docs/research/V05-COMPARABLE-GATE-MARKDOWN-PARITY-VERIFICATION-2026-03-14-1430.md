# V05 comparable-gate markdown parity verification — 2026-03-14 14:30 UTC

## Scope
Verify JSON/Markdown parity for comparison outputs in both modes:
1. comparable=true (strict clean → strict clean)
2. comparable=false (strict clean → injected non-comparable)

## Commands run
```bash
python3 packages/sdk/scripts/summarize-v05-batches.py --limit 3 --control-label baseline-same-regime --intervention-label max-turns-intervention --max-turns-configured 80 --strict
python3 packages/sdk/scripts/summarize-v05-batches.py --limit 3 --control-label baseline-same-regime --intervention-label max-turns-intervention --max-turns-configured 80 --strict
python3 packages/sdk/scripts/summarize-v05-batches.py --limit 2 --control-label same-label --intervention-label same-label --max-turns-configured 80 --strict
```

## Verified outputs
### Case A: comparable=true
- `comparison-latest.json`:
  - `comparable=true`
  - `comparabilityReasons=[]`
  - `previousRunConfigFingerprint=911f2381ec1681b975b3aaee488009d4cc137b6f41a99aae1d5f992b0e77090f`
  - `currentRunConfigFingerprint=911f2381ec1681b975b3aaee488009d4cc137b6f41a99aae1d5f992b0e77090f`
- `aggregate/latest.md` comparison section remains evaluative (full deltas shown).

### Case B: comparable=false (injected)
- strict command exited with code `2` (expected fail-closed).
- `comparison-latest.json`:
  - `comparable=false`
  - ordered `comparabilityReasons`:
    1. `strict-violation: previous/current strict violations (0/1)`
    2. `guardrail-failure: previous/current guardrails (True/False)`
    3. `runconfig-drift-outside-allowed-variable: runConfig changed outside allowed intervention variable (observedInterventionValues)`
- `aggregate/latest.md` comparison section enters non-evaluative mode and suppresses metric-delta interpretation while preserving diagnostics.

## Result
Parity behavior is correct for both comparable states:
- JSON remains machine-readable for gating logic.
- Markdown mirrors status and policy (evaluative only when comparable=true).

## Caveat
This verifies comparison-output parity/policy only. It does not broaden strict-class coverage beyond the currently implemented contamination classes.
