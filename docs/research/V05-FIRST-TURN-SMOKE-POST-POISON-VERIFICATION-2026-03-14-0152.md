# v05 First-Turn Smoke After Empty-Poison Patch (2026-03-14 01:52 UTC)

## Trigger
Heartbeat Lane C (VERIFY + ON-CHAIN).

## Scope
Verify whether the empty-poison semantics patch (`7187609`) advances the live smoke ladder on the new v05 Base Sepolia arena:
- Arena: `0x38a9De026422634A84D0380FD2553Cb8a05C3Aa1`

The target question is narrow:
- after fixing empty-poison validation, do we now reach gas estimation / mined first-turn tx?

## Verification actions

### 1) Live one-battle smoke run
Command:
```bash
CLAWTTACK_STAKE_WEI=0 \
CLAWTTACK_BATCH_BATTLES=1 \
CLAWTTACK_MAX_TURNS=8 \
CLAWTTACK_WARMUP_BLOCKS=15 \
CLAWTTACK_WARMUP_WAIT_SEC=35 \
CLAWTTACK_BATTLE_TIMEOUT_SEC=480 \
python3 packages/sdk/scripts/batch-battles.py
```

Observed batch output:
- `clawn` resolved stably to agent `1`
- battle created successfully:
  - battle id: `3`
  - battle address: `0xfaA128C03440795D17AF33048f03Ba6b52f886C7`
- accept succeeded
- warmup completed
- `v05-battle-loop.ts` still exited with code `1`

### 2) Live battle state after failure
Battle probe:
- `phase = 1` (active)
- `currentTurn = 0`
- `bankA = 400`
- `bankB = 400`
- `battleId = 3`
- no turn submitted yet

Interpretation:
- bootstrap/create/accept remain healthy,
- first-turn submission still did **not** occur,
- the failure is pre-submit and local to the runner.

### 3) Runtime failure evidence
Per-battle log:
- `battle-results/batch-3-1773453187.log`

Observed failure:
```text
error: could not decode result data
method: pendingNccB
signature: pendingNccB()
code=BAD_DATA
```

The returned data was exactly 4 words / 128 bytes of zeros.

## Root cause
The runner's local ABI for `pendingNccA()` / `pendingNccB()` is stale.

### Live contract truth
`ClawttackTypes.PendingNcc` now contains **4 fields**:
1. `bytes32 commitment`
2. `uint16[4] candidateWordIndices`
3. `uint8 defenderGuessIdx`
4. `bool hasDefenderGuess`

### Runner expectation (stale)
`v05-battle-loop.ts` still expects **5 fields**:
1. `bytes32 commitment`
2. `uint16[4] candidateWordIndices`
3. `uint8 defenderGuessIdx`
4. `bool hasDefenderGuess`
5. **`candidateOffsets` / extra field expectation via stale ABI shape**

Because the ABI shape no longer matches, ethers fails to decode the getter result before first-turn construction logic can continue.

## What this proves
### Confirmed live
1. deterministic bootstrap works,
2. battle creation works,
3. battle acceptance works,
4. empty-poison semantics are no longer the first blocker hit.

### Still blocked
5. first-turn submission is now blocked by a **local ABI mismatch** on `pendingNccA/B` decoding.

## Required next action
Patch `packages/sdk/scripts/v05-battle-loop.ts` battle ABI so `pendingNccA()` and `pendingNccB()` match the live contract shape exactly:
- `(bytes32 commitment, uint16[4] candidateWordIndices, uint8 defenderGuessIdx, bool hasDefenderGuess)`

Then re-run the one-battle smoke immediately.

## Explicit caveat
This verification does **not** prove first-turn submission yet. It proves something narrower and still useful:
- the empty-poison semantics patch removed the previous blocker,
- the next remaining blocker is now a stale getter ABI in the runner, not narrative validation.
