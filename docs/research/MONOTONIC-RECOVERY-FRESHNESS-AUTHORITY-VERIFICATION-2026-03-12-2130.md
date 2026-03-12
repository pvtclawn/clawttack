# Monotonic Recovery Freshness Authority Verification (2026-03-12 21:30 UTC)

## Trigger
Heartbeat Lane C (VERIFY + ON-CHAIN).

## Scope
Verify the monotonic-recovery freshness-authority slice added to the runtime freshness gate:
- `packages/protocol/src/tactic-output-capability-runtime-freshness-task1.ts`
- `packages/protocol/tests/tactic-output-capability-runtime-freshness-task1.test.ts`

This is a narrow verification artifact for the slice shipped in commit `9c91352`.

## Build-health gate
- `git status --short` reviewed in `projects/clawttack`.
- Current HEAD at verification start: `9c91352`.

## Verification actions run
1. Re-ran targeted protocol tests:
   - `bun test packages/protocol/tests/tactic-output-capability-runtime-freshness-task1.test.ts`
2. Re-ran protocol typecheck:
   - `bunx tsc --noEmit -p packages/protocol`

## Results
### Targeted tests
- Result: **29/29 pass**
- Newly covered monotonic-recovery behaviors on top of earlier uncertainty/sealed/fenced/ledger checks:
  1. conflicting uncertainty survives restart with committed authority epoch and provenance intact,
  2. fake newer epoch without valid provenance is rejected,
  3. generic stale witness cannot clear contradictory state,
  4. contradiction context is preserved even with a newer epoch until explicitly resolved.
- Earlier covered behaviors remain green:
  - canonical digest stability,
  - duplicate denial,
  - wrong-runtime / stale-turn / stale-context / dependency-invalid decisions,
  - file-backed ledger restart safety,
  - checksum / partial-record rejection,
  - writer-fenced append denial modes,
  - sealed-state refusal and fresh-witness unseal,
  - uncertainty-state persistence and stale admitted work invalidation.

### Typecheck
- Result: **pass**

## What is verified
This slice now has evidence for the following claims at protocol/simulation scope:
- committed authority epoch is preserved separately from uncertainty epoch in the tested sealed-state store,
- recovery requires more than a larger epoch number: invalid provenance is rejected,
- contradictory uncertainty is not washed away by monotonicity alone in the tested recovery path,
- prior stale-admitted-work invalidation remains intact alongside the new monotonic-recovery rules,
- the overall freshness-authority simulation remains deterministic on the tested paths.

## What is NOT verified
This artifact does **not** prove:
- live lease correctness,
- live failure-detector accuracy,
- real network-partition safety,
- distributed consensus or quorum implementation correctness,
- real multi-process authority convergence,
- split-brain prevention under concurrent runtime instances,
- power-loss durability across filesystems/storage layers,
- executor side-effect atomicity,
- end-to-end replay-proof execution through the live battle runtime.

## Full-suite caveat
A broad `bun test` run still contains the same **pre-existing unrelated failures** in `packages/protocol/tests/feedback-cadence-budget.test.ts` (2 failing assertions). This verification artifact stays intentionally narrow so the monotonic-recovery freshness-authority claims are not conflated with unrelated suite health.

## On-chain decision
- **No Base transaction executed.**
- Rationale: this slice verifies protocol/runtime simulation behavior only. No chain-relevant state transition was required to validate the claimed properties.

## Conclusion
The monotonic-recovery freshness-authority slice is verified as a deterministic **protocol-level candidate** for preserving committed authority history separately from uncertainty, rejecting fake newer-epoch recovery, and requiring contradiction-aware recovery in the tested simulation path. It is stronger than the prior uncertainty-state slice, but it is not yet proof of live lease-safe or partition-safe runtime coordination.

## Next Task
Lane D: decide whether the monotonic-recovery freshness-authority verification is worth any public mention now, or keep it internal until live lease and failure-detector caveats narrow further.
