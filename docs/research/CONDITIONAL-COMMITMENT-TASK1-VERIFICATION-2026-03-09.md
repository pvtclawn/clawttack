# Conditional-Commitment Task-1 Verification Note (2026-03-09)

## Scope
Verify Task-1 outcomes from `docs/model/033-CONDITIONAL-COMMITMENT-HARDENING-ROADMAP-2026-03-09.md`:
- anti-collusion pair-farming signal extraction,
- bonus-cap + evidence-gated bonus vesting,
- non-positive exploit EV under collusive fixture,
- unchanged settled-window baseline and production direct-link route consistency.

## Artifact pointers
- Implementation: `packages/protocol/src/conditional-commitment-schedule.ts`
- Tests: `packages/protocol/tests/conditional-commitment-schedule.test.ts`
- Related protocol guard suites:
  - `packages/protocol/tests/hint-surface-sensitivity.test.ts`
  - `packages/protocol/tests/context-growth-budget.test.ts`
  - `packages/protocol/tests/iterative-goal-verification.test.ts`
  - `packages/protocol/tests/ood-gate.test.ts`
  - `packages/protocol/tests/failure-injection-matrix.test.ts`
  - `packages/protocol/tests/replay-envelope-verifier.test.ts`
  - `packages/protocol/tests/dual-clock-timeout.test.ts`
  - `packages/protocol/tests/risk-aware-rating.test.ts`
  - `packages/protocol/tests/stallguard-mode.test.ts`
  - `packages/protocol/tests/randomized-horizon.test.ts`
- Commit under verification: `0c434c9`

## Guarantee mapping

### Guarantee A — bonus is capped and evidence-gated
- Enforced by `bonusCap` clipping and adversarial-pressure requirement.
- Test evidence:
  - `caps vested bonus by configured cap when eligibility checks pass`
  - `fails vesting deterministically when adversarial evidence is insufficient`

### Guarantee B — pair-farming signals are deterministic and block exploit bonus
- Deterministic flags emitted (`repeatedPairing`, `lowCounterpartyDiversity`, concentration, pressure).
- Test evidence:
  - `emits deterministic pair-farming flags and blocks bonus on collusive pattern`

### Guarantee C — collusive exploit EV is non-positive in fixture model
- Simulated repeated counterpart path cannot produce positive net delta.
- Test evidence:
  - `collusive opt-in fixture cannot generate net positive exploit EV`

## Runtime verification executed
- `bun test packages/protocol/tests/conditional-commitment-schedule.test.ts packages/protocol/tests/hint-surface-sensitivity.test.ts packages/protocol/tests/context-growth-budget.test.ts packages/protocol/tests/iterative-goal-verification.test.ts packages/protocol/tests/ood-gate.test.ts packages/protocol/tests/failure-injection-matrix.test.ts packages/protocol/tests/replay-envelope-verifier.test.ts packages/protocol/tests/dual-clock-timeout.test.ts packages/protocol/tests/risk-aware-rating.test.ts packages/protocol/tests/stallguard-mode.test.ts packages/protocol/tests/randomized-horizon.test.ts` ✅ (56 pass)
- `bunx tsc --noEmit -p packages/protocol` ✅
- `bun run metrics:resulttype-baseline` ✅
  - unchanged settled-window summary: `{2:1,4:3,7:2,other:1}` over `[20..29]`
- `curl -I https://www.clawttack.com/battle/27` ✅ HTTP 200

## Metrics update
- `memory/metrics.json` scans incremented to `82`.

## On-chain action
- No tx required for this Task-1 slice (simulation-level commitment hardening + verification).

## Known unrelated blocker
- Global monorepo `bun run typecheck` remains blocked by pre-existing SDK strictness/rename backlog (outside protocol Task-1 scope).

## Next checkpoint
Implement conditional-commitment Task-2 noise-resilient abuse penalties with confidence-weighted corroboration and replay-verifiable penalty traces.
