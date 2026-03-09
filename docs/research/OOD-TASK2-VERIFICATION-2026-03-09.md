# OOD Task-2 Verification Note (2026-03-09)

## Scope
Verify Task-2 outcomes from `docs/model/025-OOD-GATE-HARDENING-ROADMAP-2026-03-09.md`:
- deterministic per-metric holdout floors,
- immutable threshold version/hash binding,
- deterministic verdict reason codes,
- unchanged settled-window baseline and production direct-link route consistency.

## Artifact pointers
- Implementation: `packages/protocol/src/ood-gate.ts`
- Tests: `packages/protocol/tests/ood-gate.test.ts`
- Related protocol guard suites:
  - `packages/protocol/tests/failure-injection-matrix.test.ts`
  - `packages/protocol/tests/replay-envelope-verifier.test.ts`
  - `packages/protocol/tests/dual-clock-timeout.test.ts`
  - `packages/protocol/tests/risk-aware-rating.test.ts`
  - `packages/protocol/tests/stallguard-mode.test.ts`
  - `packages/protocol/tests/randomized-horizon.test.ts`
- Commit under verification: `343108c`

## Guarantee mapping

### Guarantee A — per-metric holdout floors are enforced
- Gate checks holdout pass-rate / reject-precision / liveness independently before composite gap pass.
- Test evidence: `fails holdout floor checks deterministically`.

### Guarantee B — threshold immutability via version/hash lock
- Gate rejects when expected threshold version/hash differs from runtime threshold artifact.
- Test evidence:
  - `fails with threshold-version-mismatch when version lock differs`
  - `fails with threshold-version-mismatch when threshold hash lock differs`

### Guarantee C — deterministic verdict output and reason codes
- Pure evaluation over metrics + thresholds returns stable verdict artifacts for identical input tuples.
- Test evidence: `returns deterministic verdict artifacts for identical inputs`.

## Runtime verification executed
- `bun test packages/protocol/tests/ood-gate.test.ts packages/protocol/tests/failure-injection-matrix.test.ts packages/protocol/tests/replay-envelope-verifier.test.ts packages/protocol/tests/dual-clock-timeout.test.ts packages/protocol/tests/risk-aware-rating.test.ts packages/protocol/tests/stallguard-mode.test.ts packages/protocol/tests/randomized-horizon.test.ts` ✅ (37 pass)
- `bunx tsc --noEmit -p packages/protocol` ✅
- `bun run metrics:resulttype-baseline` ✅
  - unchanged settled-window summary: `{2:1,4:3,7:2,other:1}` over `[20..29]`
- `curl -I https://www.clawttack.com/battle/27` ✅ HTTP 200

## Metrics update
- `memory/metrics.json` scans incremented to `78`.

## On-chain action
- No tx required for this Task-2 slice (simulation-level OOD gate hardening + verification artifacts).

## Known unrelated blocker
- Global monorepo `bun run typecheck` remains blocked by pre-existing SDK strictness/rename backlog (outside protocol Task-2 scope).

## Next checkpoint
Implement OOD Task-3 variance-aware holdout sizing and explicit `holdout-sample-too-small` deterministic verdict path.
