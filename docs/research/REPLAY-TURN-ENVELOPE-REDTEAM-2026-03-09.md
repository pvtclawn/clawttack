# Replay-Resistant Turn Envelope — Red-Team Findings (2026-03-09)

Input: `docs/model/020-REPLAY-RESISTANT-TURN-ENVELOPE-PLAN-2026-03-09.md`
Companion critique log: `memory/challenges/2026-03-09--replay-resistant-turn-envelope-red-team.md`

## Top exploit risks
1. Counter desync griefing can block valid progress without forging signatures.
2. Channel-context canonicalization gaps can permit downgrade/bypass replays.
3. Previous-hash pinning can force persistent mismatch deadlocks.
4. Replay-cache growth can be abused for memory/perf pressure.
5. Over-strict rejection can trade integrity gains for unacceptable liveness loss.

## Hardening directions
- Add bounded, deterministic resync path anchored to chain-finalized turn state.
- Canonicalize channel-context bytes and reject non-canonical encodings.
- Introduce bounded ancestry reconciliation for previous-hash mismatch handling.
- Use battle-scoped bounded replay cache with expiry and peer-level rate limits.
- Add recoverable `needs-resync` state before terminal reject in ambiguous conditions.

## Acceptance gates for next implementation slice
1. Desync adversarial fixtures preserve liveness while rejecting true replays.
2. Canonicalization fixtures reject equivalent-string/non-equivalent-byte contexts.
3. Replay-cache stress tests stay within bounded memory/perf budgets.
4. False-positive rejection rate stays below agreed threshold in simulated relay jitter.
