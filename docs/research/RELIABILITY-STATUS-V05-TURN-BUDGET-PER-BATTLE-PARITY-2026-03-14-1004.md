# Reliability Status — v05 turn-budget per-battle parity (2026-03-14 10:04 UTC)

## Scope
Synthesis of Lane C verification for canonical per-battle turn-budget usage fields after adding:
- `maxTurnsConfigured`
- `turnsMined`
- `turnBudgetUsed`
- `turnBudgetUnused`
- `turnsRemainingToCap`
- `turnBudgetUsageRatio`

## What is now reliable
1. **Per-battle turn-budget semantics are explicit and stable** in JSON + Markdown outputs.
2. **JSON/Markdown parity is verified** for the same battle artifact (`batch-9-1773457393`) with matching values:
   - `maxTurnsConfigured=80`
   - `turnsMined=3`
   - `turnBudgetUsed=false`
   - `turnBudgetUnused=true`
   - `turnsRemainingToCap=77`
   - `turnBudgetUsageRatio=0.0375`
3. **Intervention labeling/partitioning remains present** (`controlLabel`, `interventionLabel`, `sharedRegimeMetrics`, `interventionTargetMetrics`) and compatible with the new per-battle fields.

## What is still not reliable enough
1. **Aggregate used-vs-unused turn-budget accounting is not implemented yet** under `interventionTargetMetrics`.
2. **No intervention batch conclusion should be made** from current tiny sample and pre-aggregate budget accounting.
3. `comparison-latest.json` CLI persistence behavior still needs explicit verification in the current code path.

## Honest claim boundary
Current claim should remain narrow: *the per-battle turn-budget semantics and JSON/Markdown parity are verified; aggregate budget-use accounting and intervention inference are pending.*

## Next best step
Implement aggregate used-vs-unused turn-budget counts/ratio (partitioned under `interventionTargetMetrics`), then verify against a fresh labeled summary refresh before running the intervention batch.
