# REDTEAM — v05 intervention outcome (`pendingVopB` decode + unsettled-share risk)

## Trigger
Heartbeat Lane F after intervention batch (`max-turns-120`) produced one decode anomaly and fully unsettled tiny sample.

## Findings
1. **`pendingVopB()` decode boundary is currently the highest-confidence blocker**
   - Evidence: `BAD_DATA` decode error in `batch-25-1773505412.log` and reflected aggregate failure histogram.
   - Interpretation: likely interface/ABI shape drift at runner boundary, not necessarily mechanism logic failure.

2. **Current intervention sample remains exploratory and underpowered**
   - `sampleSize=3`, `unsettledShare=1.0`, `settlementObservedCount=0`.
   - Any comparative claims beyond directional diagnostics are premature.

3. **`unknown` stage bucket is too coarse for patch prioritization**
   - Interface decode faults and genuine unknown runtime progression currently collapse into one stage class.

4. **Guardrail stack is healthy but not yet interface-drift-aware**
   - `strictViolationCount=0` and comparable-gate behavior are functioning.
   - This does not cover contract getter tuple-shape drift classes like `pendingVopB`.

## Recommended next slice (smallest useful)
1. Patch `v05-battle-loop.ts` VOP pending getter declarations to exact live contract shape.
2. Add deterministic failure classification prefixes (`interface-decode/*`, `runtime/*`) in summarizer ingestion.
3. Re-run one strict labeled smoke (`BATTLES=1`, same labels) and require:
   - no `pendingVopB` decode error,
   - stage advancement beyond `unknown`,
   - persisted per-battle + aggregate refresh.

## Non-overclaim caveat
This red-team slice narrows likely failure class and prioritizes patch order. It does **not** prove settlement reliability or intervention efficacy.