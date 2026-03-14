# V05 Failure Taxonomy Split Verification — 2026-03-14 18:05

## Scope
Verify that the new summarizer failure taxonomy split (`interface-decode/*` vs `runtime/*`) is active on recent artifacts and parity-visible in aggregate outputs.

## Verification actions
- Ran strict labeled refresh:
  - `python3 packages/sdk/scripts/summarize-v05-batches.py --limit 3 --control-label baseline-same-regime --intervention-label max-turns-120 --max-turns-configured 120 --strict`
- Inspected outputs:
  - `battle-results/summaries/aggregate/latest.json`
  - `battle-results/summaries/aggregate/latest.md`
  - recent per-battle summaries in `battle-results/summaries/per-battle/`

## Verified results
1. Aggregate failure histogram is classed (not all raw strings):
   - `runtime/generic: 1`
   - `none: 2`
2. Per-battle output now carries both:
   - `failureClass` (taxonomy bucket)
   - `failureDetail` (raw context string)
3. JSON/Markdown aggregate parity is preserved for failure histogram reporting.
4. Strict guardrails remained healthy for this refresh:
   - `strictMode=true`
   - `strictViolationCount=0`

## Narrow caveat
- Historical summaries generated before the taxonomy split can still contain legacy raw `failureClass` strings (e.g., prior `pendingVopB BAD_DATA` artifact snapshots).
- Current verification confirms taxonomy behavior on refreshed recent windows, not full historical backfill normalization.

## Outcome
Taxonomy split is functioning for current strict-refresh artifacts and is stable enough to move to reliability synthesis before optional subtype expansion.
