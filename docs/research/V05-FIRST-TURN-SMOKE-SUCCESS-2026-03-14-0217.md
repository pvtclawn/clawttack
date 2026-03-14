# v05 First-Turn Smoke Success (2026-03-14 02:17 UTC)

## Trigger
Heartbeat Lane C (VERIFY + ON-CHAIN).

## Scope
Verify whether the `pendingNccA/B` getter ABI correction (`f6e2ef1`) advances the live v05 smoke ladder beyond decode and into real turn submission on the new Base Sepolia arena.

Arena:
- `0x38a9De026422634A84D0380FD2553Cb8a05C3Aa1`

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

Observed result:
- batch runner exited cleanly
- per-battle loop completed with a saved checkpoint
- no decode failure on `pendingNccA/B`

### 2) Live battle produced real submitted turns
Smoke battle:
- battle id: `5`
- battle address: `0x7Bd5D1f97F5a1B02a714dD567087fD04a3892A0E`

Checkpoint artifact:
- `battle-results/checkpoints/batch-5-1773454730.json`

Turn submissions recorded:
1. turn `0` — agent `B`
   - tx: `0xf48fd78590719684650f462a3428516c1cab157ab04a6c89b396340fb5686921`
   - block: `38843246`
   - gas: `1307030`
2. turn `1` — agent `A`
   - tx: `0x47cb8e846fe8291a2635bfe3ddbecf15d2a0e97e81046699603a2a7d6a7b39c1`
   - block: `38843255`
   - gas: `1179003`
3. turn `2` — agent `B`
   - tx: `0x0ef721229d6286f2544d6fc7f0360e85ed0969a5d42e8ea112cdcf7621e0373c`
   - block: `38843262`
   - gas: `1438732`

### 3) Runtime stage evidence
Per-battle log shows the runner explicitly reached:
- pending-state fetch,
- payload assembly,
- submit path,
- repeated successful turn progression.

Relevant console tail:
- turn `0` side `B` submitted
- turn `1` side `A` submitted
- turn `2` side `B` submitted
- loop completed and checkpoint was saved

### 4) Live battle state after smoke
`getBattleState()` on the battle clone returned:
- `phase = 1`
- `currentTurn = 3`
- `bankA = 400`
- `bankB = 347`
- `sequenceHash = 0x782105ab99c4e943c9a21843d86cff2084e3abb9bf890862d9201a796b4b5d74`
- `battleId = 5`

Interpretation:
- the smoke ladder advanced beyond first-turn submission,
- the battle remains active after three successful turns,
- we now have real gameplay data rather than only create/accept artifacts.

## Acceptance mapping
### A. `pendingNccA/B` decode succeeds
Observed evidence:
- no `BAD_DATA` decode failure occurred
- loop progressed into real turn submission

### B. Payload assembly succeeds
Observed evidence:
- stage logs reached `payload assembled, estimating/sending submitTurn`
- three turns were submitted successfully

### C. First-turn tx mines successfully
Observed evidence:
- turn `0` tx mined: `0xf48fd78590719684650f462a3428516c1cab157ab04a6c89b396340fb5686921`

### D. Ladder advances beyond the immediate blocker
Observed evidence:
- turns `1` and `2` also mined successfully
- runner completed without crash

## Verdict
This is the first live proof that v05 has moved beyond setup-only smoke:
- deployment works,
- bootstrap works,
- create/accept work,
- candidate embedding works,
- empty-poison semantics work,
- `pendingNcc` ABI drift is fixed,
- and real turn submissions now mine on Base Sepolia.

## What this does NOT prove yet
It does **not** yet prove:
- full battle settlement reliability,
- reveal-path correctness across many turns,
- active-poison behavior under later-turn pressure,
- trustworthy large-sample gameplay metrics.

But it does prove that the live smoke ladder has crossed the most important threshold so far:
- **we now have actual on-chain turn data.**

## Best next action
Increase from single-battle smoke to controlled low-volume batch collection while preserving stage/metrics logging, then analyze:
- resultType distribution,
- average turns reached,
- bank depletion patterns,
- NCC/VOP behavior,
- active-poison behavior once later turns surface it.
