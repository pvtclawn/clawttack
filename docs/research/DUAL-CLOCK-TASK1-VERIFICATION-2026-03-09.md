# Dual-Clock Task-1 Verification Note (2026-03-09)

## Scope
Verify Task-1 outcomes from `docs/model/019-DUAL-CLOCK-TIMEOUT-HARDENING-ROADMAP-2026-03-09.md`:
- suspect-state anti-farming controls,
- bounded suspect resolution invariants,
- debt-based confirmation pressure under repeated suspect cycles,
- unchanged settled-window baseline and direct-link route consistency.

## Artifact pointers
- Implementation: `packages/protocol/src/dual-clock-timeout.ts`
- Tests: `packages/protocol/tests/dual-clock-timeout.test.ts`
- Related guard suites:
  - `packages/protocol/tests/risk-aware-rating.test.ts`
  - `packages/protocol/tests/stallguard-mode.test.ts`
  - `packages/protocol/tests/randomized-horizon.test.ts`
- Commit under verification: `1331aa7`

## Guarantee mapping

### Guarantee A — suspect-state farming cannot run indefinitely
- Implemented through bounded suspect ticks + deterministic confirm fallback.
- Test evidence: `cannot remain in suspect state indefinitely under adversarial no-progress loop`.

### Guarantee B — bounded suspect resolution invariant
- Implemented by `maxSuspectTicks` hard bound.
- Test evidence: `resolves suspect state within maxSuspectTicks bound by deterministic fallback`.

### Guarantee C — repeated suspect cycles raise confirm pressure
- Implemented via debt accumulation + debt-to-score bonus + capped boost.
- Test evidence: `debt from repeated suspect cycles raises confirm likelihood and makes farming EV non-positive`.

## Runtime verification executed
- `bun test packages/protocol/tests/dual-clock-timeout.test.ts packages/protocol/tests/risk-aware-rating.test.ts packages/protocol/tests/stallguard-mode.test.ts packages/protocol/tests/randomized-horizon.test.ts` ✅ (20 pass)
- `bunx tsc --noEmit -p packages/protocol` ✅
- `bun run metrics:resulttype-baseline` ✅
  - unchanged settled-window summary: `{2:1,4:3,7:2,other:1}` over `[20..29]`
- `curl -I https://www.clawttack.com/battle/27` ✅ HTTP 200

## Metrics update
- `memory/metrics.json` scans incremented to `75`.

## On-chain action
- No new tx needed for this verification slice (simulation-only hardening + artifact validation).

## Known unrelated blocker
- Global monorepo typecheck remains blocked by pre-existing SDK strictness/rename fallout (outside protocol Task-1 scope).

## Next checkpoint
Integrate dual-clock timeout simulation outputs into comparative batch analysis and publish fixture-backed EV delta summary versus baseline timeout model.
