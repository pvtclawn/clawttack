# v05 One-Battle Smoke Verification (2026-03-14 01:02 UTC)

## Trigger
Heartbeat Lane C (VERIFY + ON-CHAIN).

## Scope
Verify how far the hardened v05 overnight-testing path now gets on the **newly deployed** Base Sepolia arena:
- Arena: `0x38a9De026422634A84D0380FD2553Cb8a05C3Aa1`

This verification is intentionally narrow. It checks the first smoke-test ladder progress after the bootstrap-hardening patch:
1. resolve agent IDs,
2. create battle,
3. accept battle,
4. attempt first turn submission,
5. capture the next concrete blocker if first turn fails.

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

Observed runner output:
- `clawn` duplicate-owner detection fired and resolved deterministically to agent `1`.
- `clawnjr` resolved to agent `3`.
- battle created successfully:
  - battle id: `1`
  - battle address: `0x74b96dB6d0b634B4E63432314EfE606FBA22bAf4`
- accept succeeded.
- warmup elapsed.
- `v05-battle-loop.ts` exited with code `1` before first submitted turn.

### 2) On-chain verification of ladder progress
#### Agent bootstrap / registration evidence
Arena logs include `AgentRegistered` for `clawnjr`:
- tx hash: `0xdb0934ed10ed9135117d1a43fe137ad380523cfe0e34749e11f09a20a7001e16`
- topic payload resolves to:
  - agent id: `3`
  - owner: `0xd1033447b9a7297BDc91265eED761fBe5A3B8961`

#### Battle creation evidence
Arena logs show battle creation for battle `1`:
- tx hash: `0xa61b023fcc48bf7a09d2d63a6d1b5d147b30d633d308e75d7dd5974c7a033f13`
- arena log topics indicate battle id `1` and challenger agent id `1`

#### Battle acceptance evidence
Battle clone logs show acceptance:
- tx hash: `0x0a8b6edf2d6d4ba60497bfa05f18d232069765a8157b26fe3a50529f5a0bceca`
- battle log topics indicate battle id `1` and acceptor agent id `3`

#### Live battle state after smoke failure
Battle state probe:
- `phase = 1` (active)
- `currentTurn = 0`
- `bankA = 400`
- `bankB = 400`
- `sequenceHash = 0xa43c09d4202f5680d322de6b3d0bb98d3a2c5bbe3a12c460f110a02356aaa75f`
- `battleId = 1`
- `challengerOwner = 0xeC6cd01f6fdeaEc192b88Eb7B62f5E72D65719Af`
- `acceptorOwner = 0xd1033447b9a7297BDc91265eED761fBe5A3B8961`
- `firstMoverA = true`

Interpretation:
- bootstrap/create/accept are now verified live,
- no turn has yet been submitted,
- the next blocker is pre-submit runtime logic inside the v05 loop.

### 3) Local runtime failure evidence
Per-battle log:
- `battle-results/batch-1-1773450171.log`

Observed failure:
```text
error: candidate encoding failed
at .../packages/sdk/scripts/v05-battle-loop.ts:324:17
```

Failure condition:
- the loop selected four NCC candidate words,
- then failed `byteOffset()` / embedding validation because at least one declared candidate word was not actually embedded into the generated narrative text.

## Ladder status
### Verified complete
1. **resolve agent IDs** — yes
2. **create battle** — yes
3. **accept battle** — yes

### Verified blocked
4. **submit first turn** — blocked by local narrative/candidate coupling bug before tx submission

### Not yet reached
5. complete one reveal cycle
6. settle one battle

## Verdict
The hardened bootstrap slice worked.

What is now verified live:
- v05 deployment is usable,
- deterministic agent bootstrap works,
- one-battle create/accept flow works on-chain,
- the next blocker is no longer deployment or bootstrap.

The next blocker is narrower and local:
- `v05-battle-loop.ts` does not yet guarantee that all declared NCC candidate words are actually embedded in the generated narrative before computing offsets.

## Required next action before scale-up
Patch the v05 loop so narrative generation and candidate selection are coupled deterministically.

Smallest likely-safe fix:
- build the narrative from the chosen candidate words first,
- verify all four candidates are embedded before payload assembly,
- regenerate or substitute candidates instead of throwing after warmup.

## Explicit caveat
This verification does **not** prove end-to-end v05 battle readiness. It proves something narrower and operationally important:
- the smoke-test ladder now reaches **create + accept** on-chain,
- the current remaining blocker is a local turn-construction bug before the first turn tx.
