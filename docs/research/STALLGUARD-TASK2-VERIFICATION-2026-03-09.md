# StallGuard Task-2 Verification Note (2026-03-09)

## Scope
Verify Task-2 outcomes from `docs/model/015-STALLGUARD-HARDENING-ROADMAP-2026-03-09.md`:
- bilateral opt-in gating,
- mode-off baseline-equivalence checks,
- canary-disable override,
- no route regression in production direct links.

## Artifact pointers
- Implementation: `packages/protocol/src/stallguard-mode.ts`
- Tests: `packages/protocol/tests/stallguard-mode.test.ts`
- Related invariant tests: `packages/protocol/tests/randomized-horizon.test.ts`
- Commit under verification: `ff22798`

## Gate mapping

### Gate A — bilateral commitment requirement
- Verified by `resolveStallGuardMode()` paths:
  - one-sided opt-in => disabled (`missing-bilateral-opt-in`)
  - both opt-in + feature flag => enabled
- Test coverage: `does not enable without bilateral opt-in`, `enables only when all gates pass`.

### Gate B — global kill switch safety
- Verified by canary override path in `resolveStallGuardMode()`.
- Test coverage: `global canary disable wins over all local settings`.

### Gate C — mode-off baseline-equivalence
- Verified by `checkModeOffBaselineEquivalence()` with deterministic mismatch reporting.
- Test coverage:
  - exact trace match => equivalent,
  - length mismatch => deterministic failure,
  - content mismatch => deterministic index.

## Runtime verification executed
- `bun test packages/protocol/tests/stallguard-mode.test.ts packages/protocol/tests/randomized-horizon.test.ts` ✅ (13 pass)
- `bunx tsc --noEmit -p packages/protocol` ✅
- `bun run metrics:resulttype-baseline` ✅
  - output unchanged: `{2:1,4:3,7:2,other:1}` over `[20..29]`
- `curl -I https://www.clawttack.com/battle/27` ✅ HTTP 200

## Metrics update
- `memory/metrics.json` scans incremented to `72`.

## Known unrelated blocker
- Global monorepo typecheck remains blocked by existing SDK strictness/rename fallout (outside Task-2 scope).

## Next checkpoint
Integrate `resolveStallGuardMode()` into battle state transition path and add integration trace fixtures proving mode-off equivalence on real battle replay logs.
