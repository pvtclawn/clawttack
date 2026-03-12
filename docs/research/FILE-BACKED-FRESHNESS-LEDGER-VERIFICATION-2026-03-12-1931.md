# File-Backed Freshness Ledger Verification (2026-03-12 19:31 UTC)

## Trigger
Heartbeat Lane C (VERIFY + ON-CHAIN).

## Scope
Verify the file-backed freshness-ledger slice added to the runtime freshness gate:
- `packages/protocol/src/tactic-output-capability-runtime-freshness-task1.ts`
- `packages/protocol/tests/tactic-output-capability-runtime-freshness-task1.test.ts`

This is a narrow verification artifact for the slice shipped in commit `35056b1`.

## Build-health gate
- `git status --short` reviewed in `projects/clawttack`.
- Current HEAD at verification start: `35056b1`.

## Verification actions run
1. Re-ran targeted protocol tests:
   - `bun test packages/protocol/tests/tactic-output-capability-runtime-freshness-task1.test.ts`
2. Re-ran protocol typecheck:
   - `bunx tsc --noEmit -p packages/protocol`

## Results
### Targeted tests
- Result: **13/13 pass**
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
  13. stable consumed-set reconstruction from duplicate valid rows.

### Typecheck
- Result: **pass**

## What is verified
This slice now has evidence for the following claims at protocol/simulation scope:
- the file-backed store fails closed before successful load,
- consumed-digest history survives process restart for the tested adapter path,
- malformed trailing records and checksum corruption are rejected deterministically,
- duplicate valid ledger rows reconstruct to the same consumed-set semantics,
- the runtime freshness gate continues to produce deterministic decision codes on the tested paths.

## What is NOT verified
This artifact does **not** prove:
- real power-loss durability across filesystems/storage layers,
- multi-writer safety or concurrent append correctness,
- compaction/snapshot correctness,
- queue recovery ordering in a live runtime,
- executor side-effect atomicity,
- end-to-end replay-proof execution across the actual battle runtime.

## Full-suite caveat
A broad `bun test` run now completes, but still contains **pre-existing unrelated failures** in `packages/protocol/tests/feedback-cadence-budget.test.ts` (2 failing assertions). This verification artifact remains intentionally narrow so the file-backed freshness-ledger claims are not conflated with unrelated suite health.

## On-chain decision
- **No Base transaction executed.**
- Rationale: this slice verifies protocol/runtime simulation behavior only. No chain-relevant state transition was required to validate the claimed properties.

## Conclusion
The file-backed freshness-ledger slice is verified as a deterministic **restart-safe protocol-level candidate** for consumed-digest persistence and corruption/truncation rejection. It is stronger than the earlier in-memory-only gate, but it is not yet proof of production-grade durable execution until power-loss, multi-writer, and live executor boundaries are addressed.

## Next Task
Lane D: decide whether the file-backed freshness-ledger verification is worth any public mention now, or keep it internal until the remaining durability caveats narrow further.
