# V05 comparable-gate verification — 2026-03-14 14:10 UTC

## Scope
Verify Task 3 comparison-level gate fields in `comparison-latest.json`:
- `comparable`
- `comparabilityReasons[]` (deterministic class ordering)

And verify behavior across:
1. strict-clean comparable path,
2. injected strict non-comparable path.

## Commands run
```bash
python3 packages/sdk/scripts/summarize-v05-batches.py \
  --limit 3 \
  --control-label baseline-same-regime \
  --intervention-label max-turns-intervention \
  --max-turns-configured 80 \
  --strict

# repeated once to create clean->clean comparison window
python3 packages/sdk/scripts/summarize-v05-batches.py \
  --limit 3 \
  --control-label baseline-same-regime \
  --intervention-label max-turns-intervention \
  --max-turns-configured 80 \
  --strict

# injected non-comparable case
python3 packages/sdk/scripts/summarize-v05-batches.py \
  --limit 2 \
  --control-label same-label \
  --intervention-label same-label \
  --max-turns-configured 80 \
  --strict
```

## Results

### A) strict-clean comparable path (clean -> clean)
- `comparable=true`
- `comparabilityReasons=[]`
- `previousRunConfigFingerprint == currentRunConfigFingerprint`
  - both: `911f2381ec1681b975b3aaee488009d4cc137b6f41a99aae1d5f992b0e77090f`
- `previousGuardrailsOk=true`
- `currentGuardrailsOk=true`
- `runConfigShapeComparable=true`

### B) injected non-comparable path (clean -> label-collapse strict run)
- strict run exits non-zero as expected (`exit=2`)
- diagnostics persisted to artifacts before exit
- `comparable=false`
- deterministic `comparabilityReasons[]` observed in expected class order:
  1. `strict-violation: previous/current strict violations (0/1)`
  2. `guardrail-failure: previous/current guardrails (True/False)`
  3. `runconfig-drift-outside-allowed-variable: runConfig changed outside allowed intervention variable (observedInterventionValues)`
- fingerprints diverged as expected:
  - previous: `911f2381ec1681b975b3aaee488009d4cc137b6f41a99aae1d5f992b0e77090f`
  - current: `03889f6601f7e9564fe41f45ab4315dba8349765f62d5e5c30a30599634ba03d`

## Verification verdict
Task 3 Task-1 slice is verified:
- comparison-level `comparable` contract works in clean and injected paths,
- `comparabilityReasons[]` is deterministic and fail-closed for covered classes,
- strict write-then-fail behavior remains intact.

## Caveat
This verification covers the currently implemented reason classes only; broader comparability classes and markdown non-evaluative policy hardening remain future slices.
