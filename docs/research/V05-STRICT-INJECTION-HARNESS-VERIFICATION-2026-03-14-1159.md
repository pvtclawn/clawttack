# V05 Strict-Injection Harness Verification — 2026-03-14 11:59

## Scope
Verify Lane C for strict-injection hardening Task 1 after adding `--self-test-strict-injections`.

## Commands
- `python3 packages/sdk/scripts/summarize-v05-batches.py --self-test-strict-injections`
- `python3 packages/sdk/scripts/summarize-v05-batches.py --limit 3 --control-label baseline-same-regime --intervention-label max-turns-control-prep --max-turns-configured 80 --strict`

## Results
Harness status: `ok`.

### Case-by-case expected vs actual strict violations
1. **label-collapse**
   - Expected: `label-hygiene: control and intervention labels collapse to same normalized value`
   - Actual: same
   - `strictViolationCount=1`

2. **max-turns-mismatch**
   - Expected: `max-turns-comparability: mixed maxTurnsConfigured values observed ([80, 120])`
   - Actual: same
   - `strictViolationCount=1`

3. **combined**
   - Expected:
     - `label-hygiene: control and intervention labels collapse to same normalized value`
     - `max-turns-comparability: mixed maxTurnsConfigured values observed ([80, 120])`
   - Actual: same two entries (same order)
   - `strictViolationCount=2`

## Artifact checks after strict clean run
- Per-battle summaries refreshed under `battle-results/summaries/per-battle/`.
- Aggregate summary refreshed at `battle-results/summaries/aggregate/latest.json`.
- Comparison summary refreshed at `battle-results/summaries/aggregate/comparison-latest.json`.

## Conclusion
- Multi-class strict-injection harness is deterministic for current covered classes.
- Expected and actual strict-violation sets match exactly for all tested classes.
- Clean strict run remains green after harness execution.

## Caveat
- Coverage currently proves three classes only (label collapse, max-turn mismatch, combined). Additional contamination classes/counters remain future hardening work.
