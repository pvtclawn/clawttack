# Randomized Horizon Task 1 — Verification Note (2026-03-09)

## Scope
Verify Task 1 guardrails from `docs/model/013-RANDOMIZED-HORIZON-GUARDRAIL-PLAN-v0.md`:
- stop-sampling ordering invariants,
- deterministic hard-cap fallback behavior,
- no immediate route-regression in production direct links.

## Artifact / code pointers
- Implementation: `packages/protocol/src/randomized-horizon.ts`
- Tests: `packages/protocol/tests/randomized-horizon.test.ts`
- Commit: `2a11574`

## Invariant mapping

### Invariant A — timeout window must not trigger stop sampling
- Enforced in `evaluateStopDecision()` early-return branch (`timeout-pending`).
- Test coverage: `never samples while timeout is pending`.

### Invariant B — only accepted turns can trigger stop sampling
- Enforced in `evaluateStopDecision()` gate on `turnAccepted`.
- Test coverage: `never samples when turn was not accepted`.

### Invariant C — deterministic hard cap is preserved
- Enforced before random-tail logic (`turnNumber >= hardCap => shouldStop=true`).
- Test coverage: `keeps deterministic hard cap when feature is disabled`.

### Invariant D — one sample per accepted turn
- Enforced by `alreadySampledThisTurn` guard (throws on duplicate).
- Test coverage: `rejects duplicate sampling for same accepted turn`.

## Runtime verification executed
- `bun test packages/protocol/tests/randomized-horizon.test.ts` ✅ (6 pass)
- `bunx tsc --noEmit -p packages/protocol` ✅
- `bun run metrics:resulttype-baseline` ✅
  - output: `memory/metrics/resulttype-baseline-2026-03-09.json`
  - current settled-window summary unchanged: `{2:1,4:3,7:2,other:1}` over `[20..29]`
- `curl -I https://www.clawttack.com/battle/27` ✅ HTTP 200

## Known unrelated blocker
- Monorepo-wide `bun run typecheck` still fails due existing SDK strictness backlog (tracked in `docs/research/SDK-TYPECHECK-ERROR-INVENTORY-2026-03-09.md`).
- No evidence this Task 1 change worsened SDK backlog.

## Next integration checkpoint
Wire `evaluateStopDecision()` into the live turn-settlement pipeline behind a feature flag and add integration test proving: `accepted turn -> single stop decision event` in state-transition logs.
