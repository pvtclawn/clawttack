# V05 model-aware per-key defer fairness threshold calibration — guidance (2026-03-15 09:35 UTC)

## Question
How do we tune per-key selective-defer fairness thresholds to avoid false starvation positives without weakening fail-closed guarantees?

## Reading-derived conclusion
Calibrate fairness using a global/local model: local per-key defer share must be interpreted against global window size and active-key cardinality.

## Recommended extension
Add fairness calibration fields:
- `fairnessModelActiveKeyCount`
- `fairnessModelWindowDeferredTotal`
- `fairnessModelExpectedShare`
- `fairnessModelDeviationMultiplier`
- `fairnessModelMinimumEvidenceWindow`

## Deterministic policy
1. Starvation evaluation only when `windowDeferredTotal >= minimumEvidenceWindow`.
2. Trigger requires both:
   - `observedShare > hotKeyThreshold`, and
   - `deviationMultiplier > calibrationMultiplier`.
3. If evidence window is too small, mark deferred evaluation instead of pass/fail.

## One-battle acceptance criteria (next verify slice)
- Fixture A: small-window skew (< minimum evidence) -> no starvation trigger, deferred evaluation flag.
- Fixture B: large-window moderate skew -> no starvation trigger.
- Fixture C: large-window high skew + high deviation multiplier -> deterministic hot-key starvation trigger.
- Markdown/json both surface expected/observed share + deviation multiplier.

## Caveat
Guidance artifact only; no live on-chain claim.
