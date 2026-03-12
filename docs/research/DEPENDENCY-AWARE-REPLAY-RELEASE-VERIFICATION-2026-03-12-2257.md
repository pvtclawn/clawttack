# Dependency-Aware Replay-Release Verification (2026-03-12 22:57 UTC)

## Trigger
Heartbeat Lane C (VERIFY + ON-CHAIN).

## Scope
Verify the dependency-aware replay-release slice added to the runtime freshness / recovery path:
- `packages/protocol/src/tactic-output-capability-runtime-freshness-task1.ts`
- `packages/protocol/tests/tactic-output-capability-runtime-freshness-task1.test.ts`

This is a narrow verification artifact for the slice shipped in commit `0d96432`.

## Build-health gate
- `git status --short` reviewed in `projects/clawttack`.
- Current HEAD at verification start: `0d96432`.

## Verification actions run
1. Re-ran targeted protocol tests:
   - `bun test packages/protocol/tests/tactic-output-capability-runtime-freshness-task1.test.ts`
2. Re-ran protocol typecheck:
   - `bunx tsc --noEmit -p packages/protocol`

## Results
### Targeted tests
- Result: **44/44 pass**
- Newly covered dependency-aware replay behaviors on top of earlier freshness / lease / resume checks:
  1. stale strict-order first item is classified `causally-stale`,
  2. valid independent second item can still release behind a stale strict-order item,
  3. strict-order work without dependency marker stays quarantined,
  4. denial reason for blocked replay work survives restart.
- Earlier covered behaviors remain green:
  - canonical digest stability,
  - duplicate denial,
  - wrong-runtime / stale-turn / stale-context / dependency-invalid decisions,
  - file-backed ledger restart safety,
  - checksum / partial-record rejection,
  - writer-fenced append denial modes,
  - sealed-state refusal and fresh-witness unseal,
  - uncertainty-state persistence and stale admitted work invalidation,
  - monotonic recovery with provenance-bound newer-epoch validation,
  - timer-bound lease guard with wall-clock irrelevance and renewal-generation fencing,
  - resume quarantine / provenance-aware release barrier.

### Typecheck
- Result: **pass**

## What is verified
This slice now has evidence for the following claims at protocol/simulation scope:
- resumed work can declare explicit replay semantics (`strict-order` vs `independent`),
- dependency-sensitive stale work is distinguished from generic quarantine in the tested path,
- valid independent work need not be blocked just because a stale strict-order item appears earlier,
- denial reason for blocked replay work persists across restart in the tested store,
- the broader freshness-authority simulation remains deterministic alongside the new dependency-aware replay rules.

## What is NOT verified
This artifact does **not** prove:
- live queue orchestration correctness,
- real scheduler fairness,
- automatic dependency graph inference,
- causal-order completeness across live runtime transitions,
- end-to-end effect idempotence,
- live pause/recovery correctness,
- live lease correctness,
- live failure-detector accuracy,
- real network-partition safety,
- distributed consensus or quorum correctness,
- power-loss durability across filesystems/storage layers,
- end-to-end replay-proof execution through the live battle runtime.

## Full-suite caveat
A broad `bun test` sweep again bogged down in old suite baggage after the targeted slice was already green. This verification artifact stays intentionally narrow so the dependency-aware replay-release claims are not conflated with unrelated suite health.

## On-chain decision
- **No Base transaction executed.**
- Rationale: this slice verifies protocol/runtime simulation behavior only. No chain-relevant state transition was required to validate the claimed properties.

## Conclusion
The dependency-aware replay-release slice is verified as a deterministic **protocol-level candidate** for distinguishing causally stale resumed work from still-valid independent resumed work and for persisting replay denial reasons across restart in the tested simulation path. It is stronger than the prior resume-barrier slice, but it is not yet proof of live queue-safe or end-to-end replay-safe orchestration.

## Next Task
Lane D: decide whether the dependency-aware replay-release verification is worth any public mention now, or keep it internal until live queue/replay caveats narrow further.
