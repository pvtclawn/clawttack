# Applied Lessons — v05 canonical ordering + contamination counters (2026-03-14 12:10 UTC)

## Scope
Learning lane artifact to guide the next implementation slice in `packages/sdk/scripts/summarize-v05-batches.py`.

## Problem
Current strict diagnostics are functional, but warning/violation representation can still drift in ordering and lacks explicit contamination counters by class.

## Recommended next slice (smallest useful)
1. Introduce a **canonical violation class registry** with deterministic ordering.
2. Build `warnings[]` and `strictViolations[]` from class IDs in that order.
3. Emit JSON-first `contaminationCounters` under aggregate output, at minimum:
   - `labelCollapseCount`
   - `blankLabelCount`
   - `maxTurnsMismatchCount`
4. Mirror counters + ordered classes in markdown.
5. Preserve existing output-boundary strict behavior (persist diagnostics, then fail if strict violations > 0).

## Acceptance criteria
- Re-running the same input yields byte-stable ordering of `warnings[]` and `strictViolations[]`.
- `contaminationCounters` exists in aggregate JSON and matches markdown values.
- Strict injection harness still passes expected sets/counts.
- Clean labeled strict run remains `strictViolationCount=0`.

## Caveat
This lane does not change runtime code; it narrows the implementation contract for the next Build lane.