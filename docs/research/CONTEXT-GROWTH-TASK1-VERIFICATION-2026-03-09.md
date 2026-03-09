# Context-Growth Task-1 Verification Note (2026-03-09)

## Scope
Verify Task-1 outcomes from `docs/model/029-CONTEXT-GROWTH-BUDGET-HARDENING-ROADMAP-2026-03-09.md`:
- moving-window utilization tracking,
- near-threshold warning-debt escalation,
- deterministic hard-stop behavior,
- unchanged settled-window baseline and production direct-link route consistency.

## Artifact pointers
- Implementation: `packages/protocol/src/context-growth-budget.ts`
- Tests: `packages/protocol/tests/context-growth-budget.test.ts`
- Related protocol guard suites:
  - `packages/protocol/tests/iterative-goal-verification.test.ts`
  - `packages/protocol/tests/ood-gate.test.ts`
  - `packages/protocol/tests/failure-injection-matrix.test.ts`
  - `packages/protocol/tests/replay-envelope-verifier.test.ts`
  - `packages/protocol/tests/dual-clock-timeout.test.ts`
  - `packages/protocol/tests/risk-aware-rating.test.ts`
  - `packages/protocol/tests/stallguard-mode.test.ts`
  - `packages/protocol/tests/randomized-horizon.test.ts`
- Commit under verification: `5b97eaa`

## Guarantee mapping

### Guarantee A — moving-window + warning-debt escalation catches near-threshold evasion
- Implemented with rolling `recentRatios` window and debt accumulation.
- Test evidence: `near-threshold oscillation cannot avoid warnings indefinitely`.

### Guarantee B — stable low-utilization fixtures avoid false escalation
- Implemented via debt decay and threshold checks.
- Test evidence: `does not escalate on stable low-utilization fixtures`.

### Guarantee C — hard threshold breach halts deterministically
- Implemented deterministic halt reason `context-budget-exceeded`.
- Test evidence:
  - `hard threshold breaches halt deterministically`
  - `already-halted state remains deterministic on subsequent steps`

## Runtime verification executed
- `bun test packages/protocol/tests/context-growth-budget.test.ts packages/protocol/tests/iterative-goal-verification.test.ts packages/protocol/tests/ood-gate.test.ts packages/protocol/tests/failure-injection-matrix.test.ts packages/protocol/tests/replay-envelope-verifier.test.ts packages/protocol/tests/dual-clock-timeout.test.ts packages/protocol/tests/risk-aware-rating.test.ts packages/protocol/tests/stallguard-mode.test.ts packages/protocol/tests/randomized-horizon.test.ts` ✅ (45 pass)
- `bunx tsc --noEmit -p packages/protocol` ✅
- `bun run metrics:resulttype-baseline` ✅
  - unchanged settled-window summary: `{2:1,4:3,7:2,other:1}` over `[20..29]`
- `curl -I https://www.clawttack.com/battle/27` ✅ HTTP 200

## Metrics update
- `memory/metrics.json` scans incremented to `80`.

## On-chain action
- No tx required for this Task-1 slice (simulation-level context-budget hardening verification).

## Known unrelated blocker
- Global monorepo `bun run typecheck` remains blocked by pre-existing SDK strictness/rename backlog (outside protocol Task-1 scope).

## Next checkpoint
Implement context-growth Task-2 mode-invariant enforcement and threshold-version locking with deterministic mismatch fixtures.
