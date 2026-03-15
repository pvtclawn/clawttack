# V05 run-context sidecar verification — 2026-03-15 12:21 UTC

## Trigger
Heartbeat Lane C after implementing the first hardened run-context sidecar slice in `packages/sdk/scripts/v05-battle-loop.ts`.

## Purpose
Verify that the new sidecar behaves like an observation ledger rather than a loose boolean cache.

## Verification method
Used a controlled local probe against the exported sidecar helpers in `v05-battle-loop.ts` with `CLAWTTACK_SKIP_MAIN=1`.

Sequence exercised:
1. create default sidecar,
2. bind `battleId=77`,
3. mark `acceptedOnChain=observed` via `battle.submitTurn.receipt`,
4. mark `terminalOnChain=observed` via `battle.getBattleState.phase`,
5. inspect final JSON shape.

Also relied on focused Bun tests in `packages/sdk/scripts/v05-battle-loop.test.ts` for:
- indeterminate-by-default milestone states,
- identity-drift rejection after binding.

## Observed result
The controlled probe produced a sidecar with:
- stable `battleId=77`
- stable `battleAddress=0x1111111111111111111111111111111111111111`
- raw artifact pointers:
  - checkpoint path
  - metadata path
- `acceptedOnChain=observed`
- `terminalOnChain=observed`
- `acceptedObservationMethod=battle.submitTurn.receipt`
- `terminalObservationMethod=battle.getBattleState.phase`
- `terminalKind=phase-exit`
- `lastUpdateSource=battle-state-poll`
- fresh `lastUpdatedAt`

## What this verifies
1. **Battle identity is carried explicitly**
   - the sidecar preserves bound battle identity rather than relying on post-hoc inference.

2. **Observation provenance is preserved**
   - accepted/terminal states are accompanied by observation methods and a last update source.

3. **Raw artifact pointers are present**
   - later summarization/comparison has stable checkpoint + metadata paths to work from.

4. **The sidecar can represent transition progression cleanly**
   - it moves from indeterminate defaults to observed states without dropping provenance.

5. **Fail-closed identity behavior is covered**
   - focused tests confirm battle-id and battle-address drift are rejected after binding.

## Caveat
This verification is controlled/local, not a fresh live battle artifact yet.
So the claim is limited to **sidecar behavior correctness**, not end-to-end battle success.

## Honest conclusion
The hardened sidecar slice is now strong enough to support the next live verification step.

> The v05 runner can now emit an observation-ledger sidecar that preserves battle identity, milestone state, and provenance well enough to support first-boundary classification on the next real run.

## Recommended next step
Use the sidecar-backed v05 runner on the next controlled live battle and verify that the resulting artifact bundle feeds the hardened summarizer without manual reconstruction.
