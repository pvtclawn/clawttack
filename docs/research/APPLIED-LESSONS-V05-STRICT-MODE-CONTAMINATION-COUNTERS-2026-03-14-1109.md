# APPLIED LESSONS — V05 strict-mode + contamination-counter semantics (2026-03-14 11:09 UTC)

## Trigger
Heartbeat Lane E after guardrail-contract parity stabilization.

## Narrow objective
Capture implementation guidance for adding strict-mode + contamination-counter semantics without destabilizing the current summary pipeline.

## Applied implementation guidance
1. **Add machine-readable contamination counters in aggregate JSON**
   - `contaminationCounters.unlabeledCount`
   - `contaminationCounters.labelCollisionCount`
   - `contaminationCounters.mixedMaxTurnsCount`
   - `contaminationCounters.outOfWindowArtifactCount`

2. **Add optional strict mode switch**
   - CLI: `--strict-guardrails`
   - Behavior: write artifacts first; if `warnings.length > 0` or any contamination counter > 0, exit non-zero.

3. **Keep deterministic semantics**
   - Guardrail status remains JSON-first (`labelHygieneOk`, `maxTurnsComparable`, `warnings[]`).
   - Markdown mirrors JSON only.

## Decision (implement now vs defer)
- Current labeled refresh is clean (`warnings=[]`, `labelHygieneOk=true`, `maxTurnsComparable=true`).
- Therefore strict-mode + contamination counters are **next-slice hardening**, not a blocker for current interpretation.

## Next smallest safe slice
Implement counters + `--strict-guardrails` in `packages/sdk/scripts/summarize-v05-batches.py`, then verify clean-path behavior stays unchanged and dirty-path exits non-zero with persisted diagnostics.