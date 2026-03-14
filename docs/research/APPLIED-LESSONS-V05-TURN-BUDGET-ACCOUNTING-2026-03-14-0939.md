# Applied Lessons — v05 Turn-Budget Accounting (2026-03-14 09:39 UTC)

## Prompted focus
Design robust **used-vs-unused max-turn accounting** for the upcoming single-variable intervention batch (higher `CLAWTTACK_MAX_TURNS`) without harming baseline comparability.

## Compact applied lessons
1. **Budget exposure must be explicit per battle**
   - Record `maxTurnsConfigured`, `turnsReached`, and `turnBudgetUsedRatio = turnsReached / maxTurnsConfigured`.
   - Keep this in per-battle artifacts so intervention effectiveness is measurable instead of inferred.

2. **Separate regime-stable from intervention-target metrics**
   - Shared-regime metrics (stage/failure histograms, first mover, settled/unsettled) remain unchanged.
   - Intervention-target metrics should include:
     - `turnBudgetUsedBattleCount` (battles where `turnsReached >= maxTurnsConfigured` or close to cap),
     - `turnBudgetUnusedBattleCount`,
     - distribution summary (`min/max/avg`) for `turnBudgetUsedRatio`.

3. **Track "unused budget" as signal, not noise**
   - If almost all battles end far below cap, then the intervention did not actually exercise the intended variable.
   - This is a decision gate for "repeat / vary / instrument next".

4. **Preserve low-volume honesty**
   - In aggregate markdown, explicitly print: "Turn-budget usage is exploratory; tiny-sample directional only." 
   - Avoid treating ratio differences as stable rates in small batches.

## Immediate implementation target (next lane)
Patch `packages/sdk/scripts/summarize-v05-batches.py` to add:
- per-battle: `maxTurnsConfigured`, `turnsReached`, `turnBudgetUsedRatio`, `turnBudgetUsedFlag`
- aggregate intervention-target section: used/unused counts + ratio summary
- markdown line with explicit tiny-sample caveat

## Why this is the smallest useful next step
It keeps the control-vs-intervention comparison interpretable and directly answers whether the `CLAWTTACK_MAX_TURNS` intervention was *actually exercised*.
