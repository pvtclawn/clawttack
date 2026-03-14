# RELIABILITY STATUS — V05 intervention labeling + metric partitioning (2026-03-14 09:34 UTC)

## Scope
Synthesis of the latest verification lane for intervention-labeling outputs in the v05 summary path.

Primary verification artifact:
- `docs/research/V05-INTERVENTION-LABELING-VERIFICATION-2026-03-14-0922.md`

## What is now reliable (narrow claim)
1. `summarize-v05-batches.py` now resolves repo root correctly and can find `battle-results/`.
2. CLI labels are present and persisted in generated artifacts:
   - `controlLabel`
   - `interventionLabel`
3. Output structure now cleanly separates:
   - `sharedRegimeMetrics`
   - `interventionTargetMetrics`
4. The current low-volume sample remains explicitly scoped and non-overclaimed:
   - all 3 battles reached multi-turn
   - no active-poison observed yet
   - no settlement observed yet

## Current caveat (still open)
- CLI-written `comparison-latest.json` persistence path still needs explicit follow-up verification for previous/current carry-over behavior across reruns (`hasPrevious` behavior).

## Decision-quality summary
- The evidence layer is now significantly better for honest baseline vs intervention interpretation.
- Next highest-value work is **turn-budget usage accounting** (used vs unused max-turn allowance) so intervention effects can be read without ambiguity.

## No-gas rationale
- This lane is local analysis/synthesis only.
- No on-chain action is justified for this claim; tx spend would not strengthen artifact-structure reliability.

## Next task
- Implement used-vs-unused turn-budget accounting in the summarizer and expose it in per-battle + aggregate outputs before running the first real intervention batch.
