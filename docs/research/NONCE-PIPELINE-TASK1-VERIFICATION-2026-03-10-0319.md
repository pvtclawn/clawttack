# Nonce-Pipeline Task-1 Verification — 2026-03-10 03:19

## Scope
Verify Task-1 simulation/tooling checks added in commit `f5e7acb`:
- `packages/protocol/src/nonce-pipeline.ts`
- `packages/protocol/tests/nonce-pipeline.test.ts`

## Checks run

### 1) Targeted Task-1 test suite
Command:
- `bun test packages/protocol/tests/nonce-pipeline.test.ts`

Result:
- **5 pass / 0 fail**

Verified guarantees:
1. deterministic snapshot fingerprints for identical snapshots,
2. monotonic nonce-floor pass path with append-only intent growth,
3. deterministic fail on nonce-floor regression,
4. deterministic fail on ledger rollback/truncation,
5. deterministic fail on stale-owner token attempts.

### 2) Protocol typecheck
Command:
- `bunx tsc --noEmit -p packages/protocol`

Result:
- **pass**

### 3) On-chain runtime sanity snapshot
Commands:
- `cast call <arena> "battlesCount()(uint256)"`
- `cast call <arena> "battles(<latest>)(address)"`
- `cast call <latestBattle> "getBattleState()(uint8,uint32,uint128,uint128,bytes32,uint256)"`

Observed:
- arena: `0x2Ab05EAB902db3FDA647b3Ec798c2D28C7489b7e`
- `battlesCount = 122`
- latest battle: `0x5DaBA46f58Bf29dc65485a551242E3c1DD96daE0`
- latest state tuple: `phase=0`, `turn=0`, `bankA=0`, `bankB=0`, `battleId=122`

Interpretation:
- Arena is live and receiving newly created battles.
- Latest battle remains open/unaccepted, consistent with known runner-side funding/acceptance turbulence rather than a Task-1 verifier regression.

### 4) Route sanity
Command:
- `curl -I https://www.clawttack.com/battle/27`

Result:
- **HTTP/2 200**

## Verdict
Nonce-pipeline Task-1 deterministic checks are verified at fixture/tooling scope.

## Explicit non-overclaim caveat
This does **not** yet prove end-to-end autonomous nonce stability in live overnight throughput. Remaining work: submit-path integration discipline + recovery/race handling under sustained load.
