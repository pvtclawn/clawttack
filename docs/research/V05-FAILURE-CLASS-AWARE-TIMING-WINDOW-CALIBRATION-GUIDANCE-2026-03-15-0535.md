# V05 failure-class-aware timing-window calibration guidance — 2026-03-15 05:35 UTC

## Question
How can mode-specific timing windows avoid false-positive liveness downgrades without weakening fail-closed authenticity?

## Reading-derived conclusion
Calibrate freshness windows with explicit failure class + message semantics context. Not all delay implies authenticity risk; some delays are expected under platform transient/intermittent behavior with retries.

## Recommended model extension
Add `timingWindowCalibrationContext`:
- `failureClass`
- `deliverySemantics`
- `windowAdjustmentClass`
- `effectiveFreshnessWindowMs`

## Deterministic policy
1. Base window comes from mode profile.
2. Bounded extension (max +20%) allowed only when:
   - failure class is `platform-transient` or `platform-intermittent`, and
   - duplicate/retry indicators support at-least-once behavior.
3. No extension for `application-level` failures.
4. All adjustments must emit explicit reason + cap info for auditability.

## One-battle acceptance criteria (next verify slice)
- Fixture A: stale evidence + `platform-transient` with retry evidence gets bounded allowance and avoids false liveness downgrade.
- Fixture B: same stale evidence + `application-level` gets no allowance and remains downgraded.
- Both fixtures expose `effectiveFreshnessWindowMs` and adjustment reason in markdown/json.

## Caveat
Guidance artifact only; no live on-chain claim.
