# APPLIED LESSONS — V05 aggregate turn-budget accounting shape (2026-03-14 10:09 UTC)

## Context
Per-battle turn-budget semantics are already implemented and parity-verified. The next blocker is aggregate accounting shape so intervention conclusions are not overclaimed from tiny samples.

## Applied lessons
1. **Partition first:** aggregate budget-use fields belong under `interventionTargetMetrics`, not shared-regime metrics.
2. **Counts + ratio together:** include `turnBudgetUsedCount`, `turnBudgetUnusedCount`, and `turnBudgetUsedRatio` so interpretation remains numeric, not anecdotal.
3. **Context-preserving interpretation:** keep settled/unsettled counts visible near budget-use metrics to avoid false causal narratives.
4. **Stable schema over prose:** use durable key names that survive run-to-run comparison artifacts.
5. **Small-sample honesty:** markdown summary should explicitly warn when denominator is too small for strong inference.

## Narrow next step
Implement aggregate used-vs-unused turn-budget counts/ratio in `packages/sdk/scripts/summarize-v05-batches.py`, then refresh labeled summaries and verify the new fields in both JSON and Markdown outputs.

## Caveat
This note tightens implementation shape only; it does not yet provide new gameplay evidence.
