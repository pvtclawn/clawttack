# REDTEAM — V05 intervention-batch execution (2026-03-14 12:35 UTC)

## Context
Current recommendation is to run an intervention-labeled low-volume batch variation (max-turn change) rather than expanding strict-class breadth immediately.

## Critical weaknesses identified
1. **Intervention contamination risk**: max-turn change can unintentionally co-vary with retries/warmup/runtime knobs.
2. **Evidence labeling gap**: labels may be syntactically present but not provably bound to the executed run configuration.
3. **Small-N inference risk**: 3-5 battle batches remain exploratory and can produce misleading deltas.
4. **Settlement-horizon confounder**: increased max turns can inflate unsettled counts without indicating gameplay regression.
5. **Asymmetry confounder**: first mover and side distribution can dominate observed deltas.
6. **Operational safety drift**: pressure to keep cadence may encourage strict-mode bypass when contaminated labels appear.

## Mitigations required for next slice
- Add run-level config fingerprint to aggregate output and comparison artifact.
- Preserve strict mode as default for intervention artifacts; keep write-then-fail behavior.
- Add explicit exploratory-confidence caveat block to aggregate markdown.
- Require paired reporting of: turn-budget usage, unsettled count, first-mover distribution.
- Keep intervention scope single-variable and reject runs with extra knob drift.

## Decision impact
Proceed only after a small Lane A planning slice codifies these safeguards as acceptance criteria for the intervention run.
