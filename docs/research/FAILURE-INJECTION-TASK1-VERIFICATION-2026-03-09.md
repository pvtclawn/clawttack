# Failure-Injection Task-1 Verification Note (2026-03-09)

## Scope
Verify Task-1 outcomes from `docs/model/023-FAILURE-INJECTION-MATRIX-HARDENING-ROADMAP-2026-03-09.md`:
- hidden/public fixture split reporting,
- context-complete replay-hash binding,
- fail-closed behavior on incomplete run context,
- unchanged settled-window baseline and production direct-link path consistency.

## Artifact pointers
- Implementation: `packages/protocol/src/failure-injection-matrix.ts`
- Tests: `packages/protocol/tests/failure-injection-matrix.test.ts`
- Related protocol guard suites:
  - `packages/protocol/tests/replay-envelope-verifier.test.ts`
  - `packages/protocol/tests/dual-clock-timeout.test.ts`
  - `packages/protocol/tests/risk-aware-rating.test.ts`
  - `packages/protocol/tests/stallguard-mode.test.ts`
  - `packages/protocol/tests/randomized-horizon.test.ts`
- Commit under verification: `288080e`

## Guarantee mapping

### Guarantee A — hidden/public fixture outcomes are reported separately
- Implemented by task-1 matrix report structure (`public` + `hidden` counters).
- Test evidence: `reports hidden/public results separately`.

### Guarantee B — replay hash is bound to full run context
- Replay hash preimage includes run context (`seed`, `schemaVersion`, `configVersion`, `moduleSet`, `fixtureId`, module/failure metadata) + fixture input.
- Test evidence:
  - `replay hash changes when context metadata changes even for same input`
  - `replay hash is deterministic for identical context + fixture input`

### Guarantee C — incomplete context fails closed
- Implemented via deterministic validation errors (`incomplete-run-context:*`).
- Test evidence: `fails closed on incomplete run context`.

## Runtime verification executed
- `bun test packages/protocol/tests/failure-injection-matrix.test.ts packages/protocol/tests/replay-envelope-verifier.test.ts packages/protocol/tests/dual-clock-timeout.test.ts packages/protocol/tests/risk-aware-rating.test.ts packages/protocol/tests/stallguard-mode.test.ts packages/protocol/tests/randomized-horizon.test.ts` ✅ (30 pass)
- `bunx tsc --noEmit -p packages/protocol` ✅
- `bun run metrics:resulttype-baseline` ✅
  - unchanged settled-window summary: `{2:1,4:3,7:2,other:1}` over `[20..29]`
- `curl -I https://www.clawttack.com/battle/27` ✅ HTTP 200

## Metrics update
- `memory/metrics.json` scans incremented to `77`.

## On-chain action
- No new tx required for this Task-1 slice (simulation-level matrix hardening + artifact validation).

## Known unrelated blocker
- Global monorepo `bun run typecheck` remains blocked by pre-existing SDK strictness/rename backlog (outside protocol Task-1 scope).

## Next checkpoint
Implement failure-injection Task-2 (compound failure coverage floor + coverage report output), while preserving deterministic replay-hash context requirements.
