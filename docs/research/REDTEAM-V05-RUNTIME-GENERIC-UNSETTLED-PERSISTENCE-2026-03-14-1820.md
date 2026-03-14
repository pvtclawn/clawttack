# REDTEAM — V05 runtime/generic anomaly + unsettled-share persistence (2026-03-14 18:20)

## Trigger
Post-refresh strict intervention summaries still show:
- `failureHistogram` including `runtime/generic`
- `unsettledShare=1.0`

## Adversarial critique
1. **Classification risk:** `runtime/generic` is too coarse for reliable mechanism-level inference.
2. **Denominator risk:** tiny windows inflate unsettled-share and can produce false urgency.
3. **Causal attribution risk:** intervention variable (`maxTurns`) may be blamed for failures that are regime-invariant.
4. **Decision risk:** scaling under unresolved subtype ambiguity can produce expensive low-signal data.

## Proposed mitigations
- Implement runtime failure subtype mapping in summarizer outputs (JSON-first, markdown parity).
- Add a strict gate: no scale-up if `runtime/generic` remains non-zero without subtype classification.
- Run one additional strict low-volume intervention refresh and compare subtype histogram deltas.

## Immediate recommendation
Next slice should be **Lane A planning** for:
1) runtime subtype mapping implementation,
2) strict confirmation sample after mapping,
3) scale-up gate tied to reduced generic ambiguity.

## Caveat
This red-team note narrows interpretation risk; it does not claim protocol/runtime correctness regression by itself.
