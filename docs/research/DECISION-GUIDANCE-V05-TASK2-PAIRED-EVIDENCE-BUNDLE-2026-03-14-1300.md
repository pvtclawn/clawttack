# Decision Guidance — V05 Task 2 paired intervention evidence bundle

## Scope
Pick the smallest high-value Task 2 slice after Task 1 (`runConfigFingerprint` + single-variable guardrail) is already in place.

## Decision
Proceed with **Task 2 now** in a narrow implementation slice focused on paired intervention evidence visibility, not new strict classes.

## Why now
1. Current guardrails already make intervention runs interpretable enough to trust artifact structure.
2. Biggest remaining ambiguity is review quality, not schema safety.
3. A paired evidence bundle directly reduces overclaim risk for tiny samples.

## Smallest next code slice (Lane B)
Implement in `packages/sdk/scripts/summarize-v05-batches.py` under `interventionTargetMetrics` and mirrored aggregate markdown:

- `turnBudgetUsedCount`
- `turnBudgetUnusedCount`
- `unsettledBattleCount`
- `firstMoverAcount`
- `firstMoverBcount`
- `exploratoryConfidence` (fixed enum value: `low`) for tiny batches

Also add one markdown caveat line:

> "This intervention batch is exploratory (tiny sample); treat directionally, not as a robustness verdict."

## Acceptance criteria
- JSON + Markdown parity for all new fields.
- Fields are intervention-scoped (no leakage from shared-regime metrics).
- Strict clean path remains green.
- No new contamination class added in this slice.

## Out of scope (defer)
- New strict-violation classes.
- Additional drift dimensions beyond max-turns.
- Any claim of broad robustness or settlement reliability.
