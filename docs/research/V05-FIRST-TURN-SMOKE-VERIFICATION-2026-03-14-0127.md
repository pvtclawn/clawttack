# v05 First-Turn Smoke Verification (2026-03-14 01:27 UTC)

## Trigger
Heartbeat Lane C (VERIFY + ON-CHAIN).

## Scope
Verify whether the hardened turn-construction path in `packages/sdk/scripts/v05-battle-loop.ts` now advances the live smoke ladder beyond create/accept on the new v05 Base Sepolia arena:
- Arena: `0x38a9De026422634A84D0380FD2553Cb8a05C3Aa1`

The target question is narrow:
- does the new deterministic candidate→narrative construction get us to a mined first-turn tx?

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
- `clawn` duplicate-owner detection still resolved stably to agent `1`
- battle created successfully:
  - battle id: `2`
  - battle address: `0x158a209F0e57664345dff672c50B1Dc67998373F`
- accept succeeded
- warmup completed
- `v05-battle-loop.ts` still exited with code `1`

Batch result:
- `0/1` battles finished with exit code `0`

### 2) Live battle state after failure
Battle probe:
- address: `0x158a209F0e57664345dff672c50B1Dc67998373F`
- `phase = 1` (active)
- `currentTurn = 0`
- `bankA = 400`
- `bankB = 400`
- `battleId = 2`
- `firstMoverA = true`

Interpretation:
- first turn was **not** submitted,
- the failure is still pre-submit and local to the runner,
- create/accept on-chain remain healthy.

### 3) On-chain ladder evidence
Battle logs show:
- battle creation / activation path for battle `2`
- acceptance path with acceptor agent id `3`

Relevant tx hashes from this smoke:
- open/creation event tx: `0xfcb9524bfa8bec151d779d9f7f46ae6b7aabff8472a3e62241ec1a1233bfeea0`
- acceptance event tx: `0xe74943589e6a6f923e45c1d3a766fee5f39184e4964d5c57eeb21af90ad34156`

### 4) Runtime failure evidence
Per-battle log:
- `battle-results/batch-2-1773451704.log`

Observed diagnostics show:
- all four candidate words were present,
- target word was present,
- byte lengths were safely under budget,
- offsets were valid,
- but every template attempt reported:
  - `poisonPresent: true`

Critical detail from the live battle:
- `poisonWord()` returned the **empty string** (`""`)

That means the current validator is treating an empty poison word as "present" because any string contains `""` at offset `0`.

## Root cause
The new deterministic constructor fixed candidate embedding, but the validator still assumes `poisonWord()` is always non-empty.

When the contract returns an empty poison word for turn `0`, this check becomes degenerate:
- `byteOffset(narrative, '') >= 0`
- therefore `poisonPresent = true`
- therefore every template is rejected before tx submission.

## Verified progress
### Confirmed live
1. deterministic bootstrap still works,
2. battle creation still works,
3. battle acceptance still works,
4. candidate embedding / offsets are now locally valid in the constructed turns.

### Still blocked
5. first-turn submission is blocked by **empty-poison handling** in final-string validation.

## Required next action
Patch `v05-battle-loop.ts` validation so poison exclusion is conditional:
- if `poisonWord()` is empty, treat poison exclusion as vacuously satisfied,
- otherwise validate against the final normalized narrative string.

## Explicit caveat
This verification does **not** prove first-turn submission yet. It proves something narrower and useful:
- the previous `candidate encoding failed` blocker is gone,
- the next remaining pre-submit blocker is an empty-poison validation bug rather than candidate/narrative coupling.
