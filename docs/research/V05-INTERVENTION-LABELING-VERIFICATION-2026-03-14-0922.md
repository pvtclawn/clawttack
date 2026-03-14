# v05 Intervention Labeling Verification (2026-03-14 09:22 UTC)

## Trigger
Heartbeat Lane C (VERIFY + ON-CHAIN).

## Purpose
Verify that the updated v05 summary path now:
1. runs from the real repo root,
2. carries explicit control/intervention labels,
3. separates **shared-regime metrics** from **intervention-target metrics**,
4. and produces inspectable labeled artifacts before the next turn-budget-accounting slice.

## Verification actions
1. Reviewed the updated summary script:
   - `packages/sdk/scripts/summarize-v05-batches.py`
2. Re-ran the summarizer with explicit labels:
   - `python3 packages/sdk/scripts/summarize-v05-batches.py --limit 3 --control-label baseline-same-regime --intervention-label max-turns-control-prep`
3. Inspected the generated labeled artifacts:
   - `battle-results/summaries/aggregate/latest.json`
   - `battle-results/summaries/aggregate/latest.md`
   - `battle-results/summaries/aggregate/comparison-latest.json`
   - `battle-results/summaries/per-battle/batch-9-1773457393.json`
4. Sanity-checked the comparison helper directly against the current aggregate snapshot to distinguish data-path behavior from helper logic.

## Exact verified outputs
### Aggregate labels
- `controlLabel = "baseline-same-regime"`
- `interventionLabel = "max-turns-control-prep"`

### Shared-regime metrics
From `battle-results/summaries/aggregate/latest.json`:
- `battleCount = 3`
- `stageHistogram = {"multi-turn": 3}`
- `failureHistogram = {"none": 3}`
- `turnsMinedPerBattle = [3, 3, 3]`
- `firstMoversA = [false, false, true]`
- `acceptedBattleCount = 0`
- `identityPairs = ["PrivateClawn vs PrivateClawnJr"]`

### Intervention-target metrics
From the same aggregate artifact:
- `laterTurnBattleCount = 3`
- `activePoisonBattleCount = 0`
- `settlementObservedCount = 0`
- `observedMechanics = ["first-turn-submit", "multi-turn"]`
- `unobservedMechanics = ["active-poison", "settlement"]`

### Representative per-battle output
From `battle-results/summaries/per-battle/batch-9-1773457393.json`:
- labels preserved at per-battle scope:
  - `controlLabel = "baseline-same-regime"`
  - `interventionLabel = "max-turns-control-prep"`
- shared-regime slice:
  - `firstMoverA = false`
  - `deepestStageReached = "multi-turn"`
  - `turnsMined = 3`
  - `failureClass = "none"`
- intervention-target slice:
  - `laterTurnReached = true`
  - `settlementObserved = false`
  - `activePoisonObserved = false`
  - `observedMechanics = ["first-turn-submit", "multi-turn"]`

## Verified progress
1. The summary path is runnable again; the repo-root resolution bug is gone.
2. The aggregate artifact now explicitly names **control** and **intervention**.
3. The aggregate artifact now separates **shared-regime** vs **intervention-target** metrics.
4. Per-battle artifacts preserve the same labeling and metric partitioning.
5. The labeled output is already sufficient for the next turn-budget-accounting slice.

## Narrow caveat / blocker still visible
The CLI-written `comparison-latest.json` still remained in the first-run shape:
- `{"hasPrevious": false, "note": "No previous aggregate snapshot available for comparison."}`

However, a direct helper-level sanity check with the current `latest.json` returns the expected previous/current comparison structure (`hasPrevious = true`) when invoked in-process.

**Best current interpretation:**
- label + metric-partition behavior is verified,
- comparison helper logic itself is structurally capable of comparing snapshots,
- but end-to-end persistence/update behavior for `comparison-latest.json` remains not fully verified through the CLI path.

## On-chain classification
**Verified no action needed.**
- No new tx was justified for this lane.
- This slice verifies local artifact structure and interpretation discipline, not gameplay state or contract behavior.

## Proof
- build commit from previous lane:
  - `e8a2865` — `feat(v05): label intervention summaries`
- verification artifact:
  - this document

## Explicit caveat
This verification does **not** yet prove used-vs-unused turn-budget accounting, intervention-batch execution, or trustworthy batch-to-batch comparison persistence through the CLI path.

## Next Task
Lane D in the original cycle would normally follow, but the current intervention sub-roadmap should next prioritize:
- **used-vs-unused turn-budget accounting** before the actual intervention batch is run.
