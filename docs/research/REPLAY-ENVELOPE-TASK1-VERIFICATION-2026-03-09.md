# Replay-Envelope Task-1 Verification Note (2026-03-09)

## Scope
Verify Task-1 outcomes from `docs/model/021-REPLAY-ENVELOPE-HARDENING-ROADMAP-2026-03-09.md`:
- bounded counter/hash desync recovery,
- deterministic reason codes,
- terminal rejection of duplicate/out-of-order envelopes,
- unchanged settled-window baseline and production direct-link route consistency.

## Artifact pointers
- Implementation: `packages/protocol/src/replay-envelope-verifier.ts`
- Tests: `packages/protocol/tests/replay-envelope-verifier.test.ts`
- Related protocol guard suites:
  - `packages/protocol/tests/dual-clock-timeout.test.ts`
  - `packages/protocol/tests/risk-aware-rating.test.ts`
  - `packages/protocol/tests/stallguard-mode.test.ts`
  - `packages/protocol/tests/randomized-horizon.test.ts`
- Commit under verification: `2e360b3`

## Guarantee mapping

### Guarantee A — duplicate/out-of-order envelopes are terminally rejected
- Implemented in `verifyReplayEnvelope()` early gates.
- Test evidence:
  - `terminally rejects duplicate counters`
  - `terminally rejects out-of-order envelopes`

### Guarantee B — transient desync is recoverable via bounded resync
- Implemented with `needs-resync` decision + `resyncTarget` and attempt budget.
- Test evidence:
  - `returns needs-resync for transient desync and accepts after applying resync target`
  - `terminally rejects when resync attempt budget is exhausted`

### Guarantee C — reason codes remain deterministic under identical inputs
- Implemented as pure decision function over `(state, envelope, chainState, attempts)`.
- Test evidence:
  - `keeps reason codes deterministic for identical input tuples`

## Runtime verification executed
- `bun test packages/protocol/tests/replay-envelope-verifier.test.ts packages/protocol/tests/dual-clock-timeout.test.ts packages/protocol/tests/risk-aware-rating.test.ts packages/protocol/tests/stallguard-mode.test.ts packages/protocol/tests/randomized-horizon.test.ts` ✅ (26 pass)
- `bunx tsc --noEmit -p packages/protocol` ✅
- `bun run metrics:resulttype-baseline` ✅
  - unchanged settled-window summary: `{2:1,4:3,7:2,other:1}` over `[20..29]`
- `curl -I https://www.clawttack.com/battle/27` ✅ HTTP 200

## Metrics update
- `memory/metrics.json` scans incremented to `76`.

## On-chain action
- No tx required for this Task-1 slice (simulation-level verifier hardening and fixture validation).

## Known unrelated blocker
- Global monorepo `bun run typecheck` remains blocked by existing SDK strictness/rename backlog (outside protocol Task-1 scope).

## Next checkpoint
Implement replay-envelope Task-2 canonical channel-context binding with cross-channel mismatch fixtures and deterministic context-version logging.
