# v05 Deployment and First Smoke (2026-03-14 00:41 UTC)

## Trigger
Heartbeat Lane D (RESEARCH + COMMUNITY), following the verified ABI-drift blocker on the old Base Sepolia arena.

## Goal
Determine whether v05 can be made live tonight and identify the next concrete blocker after deployment.

## Key findings

### 1) Foundry deployment path exists and is usable
- `~/.foundry/bin/forge` is installed locally.
- `packages/contracts/script/Deploy.s.sol` is **stale in comments**, but it imports the **current** `ClawttackArena` and `ClawttackBattle` sources.
- Therefore the deploy script is still usable for a real v05 deployment, even though its usage text still talks like the old API.

### 2) v05 stack successfully deployed to Base Sepolia
Using:
- script: `script/Deploy.s.sol:DeployV0`
- chain: Base Sepolia (`84532`)

Deployed addresses:
- Arena: `0x38a9De026422634A84D0380FD2553Cb8a05C3Aa1`
- Battle implementation: `0x4037cc2adeda77D394cb75a26A5F2Cf0CB408A68`
- Word dictionary: `0x5B0f5F0a72111D7402F97CA8ba52319A7A7Bf5F0`
- BIP39 data contract: `0xc29F4BDd4c1924fC8C074e41312C696017F109ad`
- HashPreimageVOP: `0xC77b2656cE074a826dF3EEE93b92B5a56d64Ca5c`

Deployment broadcast artifact:
- `packages/contracts/broadcast/Deploy.s.sol/84532/run-latest.json`

Relevant tx hashes:
- battle impl deploy: `0xe673796ea02067652a82a268d0a7374e72b5e51d03c554ed5f0aff8f57e2f7af`
- arena deploy: `0x3156e40df10979711e093d4facd618fd72765de0e454f4e6d2158d29075efff9`
- setBattleImplementation: `0x504b7ebdbe999a35ec792f04a78f1529bae16f365e5245e39712518570b3a9e1`
- addVop(HashPreimageVOP): `0xf5693fbfb3e170bfd4e5817be942ffff29b04cde3b62c9530fc964f35766db75`

### 3) Repo local defaults were repointed to the new v05 arena
Updated locally:
- `packages/contracts/deployments/base-sepolia.env`
- `packages/sdk/scripts/batch-battles.py` default `CLAWTTACK_ARENA`

### 4) First smoke test got past deployment but hit a script-side bootstrap blocker
A first batch smoke against the new arena did **not** fail on create-battle ABI anymore.
Instead it failed during agent setup:
- batch runner error: `Failed to register agent for account=clawn`

Manual probes narrowed this further:
- direct `registerAgent()` on the new arena succeeds
- tx hash: `0x98733b396bb524a75f530b322e167b2f2a4ffb3bc0f5ba93093e3e3adb6d79bf`
- new arena state after probing:
  - `agentsCount() = 2`
  - `agents(1).owner = 0xeC6cd01f6fdeaEc192b88Eb7B62f5E72D65719Af`
  - `agents(2).owner = 0xeC6cd01f6fdeaEc192b88Eb7B62f5E72D65719Af`

## Current diagnosis
The old blocker is resolved:
- **v05 is now live on Base Sepolia** at a new arena address.

The next blocker is narrower and script-side:
- the Python batch helper's `ensure_registered()` logic is not robust against the live registration/discovery flow,
- and because the arena permits multiple registrations by the same owner, retries can create duplicate agent IDs.

## Most likely cause
`ensure_registered()` assumes immediate, unambiguous owner lookup after registration.
That assumption is too brittle for live RPC timing and duplicate-owner registrations.

## Best next build slice
Patch `packages/sdk/scripts/batch-battles.py` so `ensure_registered()`:
1. polls for the newly visible agent ID after a successful registration tx,
2. tolerates duplicate owner registrations by returning the lowest or latest matching owned agent deterministically,
3. avoids repeated blind re-registration when the owner already exists on the current arena.

## Caveat
This note does **not** prove that end-to-end v05 battle flow is live yet.
It proves something narrower and important:
- deployment is no longer the blocker,
- overnight collection is now blocked by the batch helper's agent-bootstrap logic.
