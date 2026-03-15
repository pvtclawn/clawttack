# V05 Classification Contract Verification — 2026-03-15 00:20 UTC

## Scope
Verify that the new resumed-battle artifact classification fields surface exactly as intended before the next counted live run.

Target fields:
- `executionOutcome`
- `gameplayOutcome`
- `sourceOfMove`
- `countsAsProperBattle`
- `properBattleReasons`

## Trigger
Heartbeat Lane C after:
- `ca8f735` — `feat(v05): classify resumed battle artifacts fail-closed`

## Verification method
Used a deterministic synthetic harness that imports `packages/sdk/scripts/summarize-v05-batches.py`, constructs temporary log/checkpoint/metadata triples, and calls `build_per_battle(...)` directly.

This avoids spending gas or launching another live battle just to validate classification rendering.

## Case 1 — interrupted multi-turn run
### Synthetic inputs
- metadata execution state: `started`
- source-of-move:
  - A = `gateway-agent`
  - B = `local-script`
- checkpoint contains 2 mined turns
- no settlement hint in log

### Observed output
- `executionOutcome = supervisor-interrupted`
- `gameplayOutcome = mid-battle-interrupted`
- `countsAsProperBattle = false`
- `properBattleReasons = [execution-outcome:supervisor-interrupted, gameplay-outcome:mid-battle-interrupted]`

### Why this matters
This proves a partially successful live run with mined turns is no longer flattened into vague failure/success language. Execution-layer interruption and gameplay-layer state are now separated.

## Case 2 — clean terminal-looking run
### Synthetic inputs
- metadata execution state: `clean-exit`
- source-of-move:
  - A = `gateway-agent`
  - B = `docker-agent`
- checkpoint contains 3 mined turns
- log includes `winner:` plus `✅ v05 loop complete`

### Observed output
- `executionOutcome = clean-exit`
- `gameplayOutcome = terminal`
- `countsAsProperBattle = false`
- `properBattleReasons = [proper-battle-rubric-pending]`

### Why this matters
This proves the contract is fail-closed: even a clean, terminal-looking artifact does **not** silently self-upgrade into a proper-battle verdict before the explicit rubric lands.

## Verified conclusions
1. The new classification fields surface deterministically from artifact inputs.
2. Execution-layer interruption is separable from gameplay-layer outcome.
3. Source-of-move truth is emitted at artifact level.
4. Proper-battle classification remains fail-closed until the narrower rubric is implemented.

## On-chain classification
- **Verified no action needed.**
- No tx/gas spend was justified for this lane because the target claim was about artifact classification behavior, not live battle mechanics.

## Narrow caveat
- This verifies classification rendering and fail-closed behavior, not the final proper-battle rubric itself.
- It also does not prove a live resumed agent battle will satisfy the eventual rubric.
