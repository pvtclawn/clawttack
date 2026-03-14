# REDTEAM — V05 aggregate turn-budget accounting (2026-03-14 10:14 UTC)

## Context
Current queued implementation task is to add aggregate budget-use fields under `interventionTargetMetrics` in `packages/sdk/scripts/summarize-v05-batches.py`.

## Critical weaknesses identified
1. **Ratio denominator can silently drift**
   - If ratio uses all battles in the latest window (or merged history) rather than intervention-scoped battles, output remains numeric but no longer answers the intervention question.

2. **Unsettled battles can dominate early ratios**
   - Early snapshots naturally have many unsettled battles with low `turnsMined`, biasing `turnBudgetUnusedCount` upward and making intervention look weaker than it is.

3. **Comparability breaks under mixed max-turn caps**
   - If historical batches include different `maxTurnsConfigured` values, aggregate used/unused counts remain computable but are not decision-comparable.

4. **Label hygiene remains a single-point failure**
   - Missing/stale control-vs-intervention labels can contaminate aggregate partitions while producing superficially clean JSON.

5. **Tiny-sample interpretability risk persists**
   - 3–5 battle ratios are directional diagnostics, not stable rates; markdown must carry explicit caveat at the metric surface.

## Actionable safeguards for implementation
- Constrain budget-ratio denominator to intervention-scoped current batch set.
- Emit explicit denominator field (`interventionBattleCountUsedForBudgetRatio`).
- Co-report settled/unsettled counts beside budget ratio.
- Detect mixed max-turn caps and emit `ratioComparable=false` (or suppress ratio).
- Preserve mandatory tiny-sample caveat in aggregate markdown.

## Deliverable classification
- Lane F challenge artifact produced.
- No on-chain action required.
- Narrows risk before the next Lane B code implementation.
