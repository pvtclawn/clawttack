# Refusal-First Freshness Authority Verification (2026-03-12 20:33 UTC)

## Trigger
Heartbeat Lane C (VERIFY + ON-CHAIN).

## Scope
Verify the refusal-first freshness-authority slice added to the runtime freshness gate:
- `packages/protocol/src/tactic-output-capability-runtime-freshness-task1.ts`
- `packages/protocol/tests/tactic-output-capability-runtime-freshness-task1.test.ts`

This is a narrow verification artifact for the slice shipped in commit `dacd2a8`.

## Build-health gate
- `git status --short` reviewed in `projects/clawttack`.
- Current HEAD at verification start: `dacd2a8`.

## Verification actions run
1. Re-ran targeted protocol tests:
   - `bun test packages/protocol/tests/tactic-output-capability-runtime-freshness-task1.test.ts`
2. Re-ran protocol typecheck:
   - `bunx tsc --noEmit -p packages/protocol`

## Results
### Targeted tests
- Result: **23/23 pass**
- Covered behaviors:
  1. canonical digest stability under semantically equivalent serialization,
  2. digest change on runtime-critical binding mutation,
  3. allow path for matching fresh claim,
  4. duplicate denial after prior consumption,
  5. `wrong-runtime-binding` denial on cross-run replay,
  6. `stale-turn` denial on turn mismatch,
  7. `stale-context` denial on context version mismatch,
  8. `dependency-invalid` denial on failed prerequisite state,
  9. fail-closed behavior before ledger `load()`,
  10. restart-surviving duplicate denial across fresh adapter instances,
  11. deterministic rejection of trailing partial records,
  12. deterministic rejection of checksum corruption,
  13. stable consumed-set reconstruction from duplicate valid rows,
  14. fail-closed fenced append on missing authority state,
  15. deterministic stale-token denial for fenced append,
  16. deterministic scope-mismatch denial for fenced append,
  17. deterministic token-regression denial for fenced append,
  18. durable writer-token embedding with duplicate denial preserved after restart,
  19. sealed scope denial for authoritative append,
  20. sealed-state persistence across restart,
  21. stale witness cannot unseal,
  22. fresh matching witness can unseal and restore authoritative append,
  23. witness loss does not fail open into best-effort authoritative append.

### Typecheck
- Result: **pass**

## What is verified
This slice now has evidence for the following claims at protocol/simulation scope:
- sealed-state authority is explicit and persisted across restart for the tested scope store,
- authoritative append is denied while a scope is sealed,
- stale or missing witness cannot unseal the scope in the tested path,
- fresh matching witness can re-enable authoritative append in the tested path,
- the file-backed ledger + fenced append behavior remains deterministic alongside the new sealed-state rules.

## What is NOT verified
This artifact does **not** prove:
- live network-partition safety,
- distributed consensus or quorum implementation correctness,
- real multi-process authority convergence,
- real split-brain prevention under concurrent runtime instances,
- power-loss durability across filesystems/storage layers,
- executor side-effect atomicity,
- end-to-end replay-proof execution through the live battle runtime.

## Full-suite caveat
A broad `bun test` run still contains the same **pre-existing unrelated failures** in `packages/protocol/tests/feedback-cadence-budget.test.ts` (2 failing assertions). This verification artifact stays intentionally narrow so the refusal-first freshness-authority claims are not conflated with unrelated suite health.

## On-chain decision
- **No Base transaction executed.**
- Rationale: this slice verifies protocol/runtime simulation behavior only. No chain-relevant state transition was required to validate the claimed properties.

## Conclusion
The refusal-first freshness-authority slice is verified as a deterministic **sealed-state protocol-level candidate** for refusing authoritative append when authority confidence is lost and for requiring fresh witness before re-enabling service in the tested simulation path. It is stronger than the unfenced and merely fenced slices, but it is not yet proof of live partition-safe or consensus-safe runtime coordination.

## Next Task
Lane D: decide whether the refusal-first freshness-authority verification is worth any public mention now, or keep it internal until live partition and consensus caveats narrow further.
