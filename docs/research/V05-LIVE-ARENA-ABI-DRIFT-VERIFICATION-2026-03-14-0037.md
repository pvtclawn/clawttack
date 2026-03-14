# v05 Live Arena ABI Drift Verification (2026-03-14 00:37 UTC)

## Trigger
Heartbeat Lane C (VERIFY + ON-CHAIN).

## Scope
Verify whether the newly wired v05 overnight-testing path can create and run real battles against the **currently configured** Base Sepolia arena:
- Arena: `0x2Ab05EAB902db3FDA647b3Ec798c2D28C7489b7e`
- Chain: Base Sepolia

The target question is narrow:
- can the v05 runner/batch path open a real battle against the live arena as currently configured?

## Verification actions

### 1) Real batch-run attempts against live arena
Ran two single-battle verification windows with zero stake:
- attempt A:
  - `CLAWTTACK_STAKE_WEI=0`
  - `CLAWTTACK_BATCH_BATTLES=1`
  - `CLAWTTACK_MAX_TURNS=12`
  - `CLAWTTACK_WARMUP_BLOCKS=8`
  - failed tx hash: `0x6abec5c9992553e62c8af98a297dbb5183107f1e740b6a7f859070f7770c256d`
- attempt B:
  - `CLAWTTACK_STAKE_WEI=0`
  - `CLAWTTACK_BATCH_BATTLES=1`
  - `CLAWTTACK_MAX_TURNS=8`
  - `CLAWTTACK_WARMUP_BLOCKS=15`
  - failed tx hash: `0xa02d146c0e1c887fc2a02a39d7e00540c3e001f926ead060ae4662df3819244c`

Observed result in both cases:
- create-battle path reverted before any battle was created,
- gas used was ~`22850`, consistent with selector/ABI mismatch or immediate early revert,
- no battle/result artifact was produced.

### 2) Direct signature probes against live arena
Probed both the **new v05** and **old live** `createBattle` signatures with `cast call`.

#### New v05 signature probe
```text
createBattle(uint256,(uint256,uint32,uint256,uint8))(address)
```
Observed result:
- `execution reverted, data: "0x"`

#### Old pre-v05 signature probe
```text
createBattle(uint256,(uint256,uint32,uint256,uint8,bool),bytes32)(address)
```
Observed result:
- returned simulated battle address:
  - `0x003d15d088bd9A990774fd53c52B3afb3D51f094`

### 3) Sanity checks on live arena state
- `battlesCount()` => `171`
- `agents(1)` owner => `0xeC6cd01f6fdeaEc192b88Eb7B62f5E72D65719Af`
- ownership of agent `1` is valid for the challenger wallet used in tests, so this is **not** an owner mismatch diagnosis.

## Verdict
The v05 overnight-testing path is **blocked on live deployment mismatch**.

### What is verified
1. the newly wired v05 runner path is structurally valid locally,
2. the configured live Base Sepolia arena still accepts the **old** create-battle ABI,
3. the **new** v05 create-battle ABI is not currently accepted at that address,
4. therefore the current live address is **not yet a v05-compatible arena endpoint**.

## Most likely root cause
The repo has moved to v05 mechanics locally, but the configured Base Sepolia arena address still points at an older deployment/implementation surface.

This is more specifically an **ABI/deployment drift** problem, not a wallet/agent registration problem.

## Implication for overnight battle collection
As configured right now, we cannot truthfully "run as many v05 battles as possible" against the current arena address because battle creation itself is blocked on the first transaction.

## Required next action before scaling battle count
One of these must happen first:
1. deploy / locate a v05-compatible arena + battle implementation on Base Sepolia and repoint the runner, or
2. add a compatibility path that intentionally targets the old live arena (useful only for old mechanics, not v05 testing).

For **v05 gameplay data collection**, option 1 is the correct fix.

## Explicit caveat
This verification does **not** prove that the v05 runner is fully correct in live play; it proves something narrower and operationally critical:
- the current configured live arena endpoint is not yet compatible with the v05 battle-creation ABI expected by the new overnight-testing path.
