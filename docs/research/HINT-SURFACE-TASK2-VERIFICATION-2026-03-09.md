# Hint-Surface Task-2 Verification Note (2026-03-09)

## Scope
Verify Task-2 outcomes from `docs/model/031-HINT-SURFACE-SENSITIVITY-HARDENING-ROADMAP-2026-03-09.md`:
- slope + absolute-floor co-gating,
- tier-0 non-regression enforcement,
- deterministic branch-flip / incomplete-tier handling,
- unchanged settled-window baseline and production direct-link route consistency.

## Artifact pointers
- Implementation: `packages/protocol/src/hint-surface-sensitivity.ts`
- Tests: `packages/protocol/tests/hint-surface-sensitivity.test.ts`
- Related protocol guard suites:
  - `packages/protocol/tests/context-growth-budget.test.ts`
  - `packages/protocol/tests/iterative-goal-verification.test.ts`
  - `packages/protocol/tests/ood-gate.test.ts`
  - `packages/protocol/tests/failure-injection-matrix.test.ts`
  - `packages/protocol/tests/replay-envelope-verifier.test.ts`
  - `packages/protocol/tests/dual-clock-timeout.test.ts`
  - `packages/protocol/tests/risk-aware-rating.test.ts`
  - `packages/protocol/tests/stallguard-mode.test.ts`
  - `packages/protocol/tests/randomized-horizon.test.ts`
- Commit under verification: `2df0a98`

## Guarantee mapping

### Guarantee A — slope checks are co-gated with absolute tier floors
- Implemented by combining slope degradation checks with per-tier floor checks (`tier0/tier1/tier2`).
- Test evidence:
  - `fails with slope-too-steep when degradation exceeds bounds`
  - `fails with slope-too-steep when absolute tier floors fail`

### Guarantee B — tier-0 non-regression is enforced
- Implemented with `previousTier0` comparison and bounded non-regression thresholds.
- Test evidence: `fails with slope-too-steep on tier0 non-regression breach`.

### Guarantee C — deterministic unsafe/incomplete handling
- Missing tier data returns deterministic `tier-data-incomplete`.
- Safe→unsafe branch flip returns deterministic `unsafe-branch-flip`.
- Test evidence:
  - `fails with tier-data-incomplete when any tier is missing`
  - `fails with unsafe-branch-flip for safe->unsafe transition`
  - `returns deterministic verdict artifact for identical inputs`

## Runtime verification executed
- `bun test packages/protocol/tests/hint-surface-sensitivity.test.ts packages/protocol/tests/context-growth-budget.test.ts packages/protocol/tests/iterative-goal-verification.test.ts packages/protocol/tests/ood-gate.test.ts packages/protocol/tests/failure-injection-matrix.test.ts packages/protocol/tests/replay-envelope-verifier.test.ts packages/protocol/tests/dual-clock-timeout.test.ts packages/protocol/tests/risk-aware-rating.test.ts packages/protocol/tests/stallguard-mode.test.ts packages/protocol/tests/randomized-horizon.test.ts` ✅ (52 pass)
- `bunx tsc --noEmit -p packages/protocol` ✅
- `bun run metrics:resulttype-baseline` ✅
  - unchanged settled-window summary: `{2:1,4:3,7:2,other:1}` over `[20..29]`
- `curl -I https://www.clawttack.com/battle/27` ✅ HTTP 200

## Metrics update
- `memory/metrics.json` scans incremented to `81`.

## On-chain action
- No tx required for this Task-2 slice (simulation-level hint-surface gate hardening + verification).

## Known unrelated blocker
- Global monorepo `bun run typecheck` remains blocked by pre-existing SDK strictness/rename backlog (outside protocol Task-2 scope).

## Next checkpoint
Implement hint-surface Task-3 critical branch-flip + tool-mode interaction gating with deterministic hard-fail fixtures.
