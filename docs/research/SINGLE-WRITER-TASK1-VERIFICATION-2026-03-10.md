# Single-Writer Task-1 Verification — 2026-03-10 02:57

## Scope
Verify Task-1 implementation from commit `4d0cfff`:
- `packages/protocol/src/single-writer-fencing.ts`
- `packages/protocol/tests/single-writer-fencing.test.ts`

Goal: deterministic submit-path fencing-token guard with fail-closed stale-token reasons.

## Checks run

### 1) Targeted Task-1 tests
Command:
- `bun test packages/protocol/tests/single-writer-fencing.test.ts`

Result:
- **4 pass / 0 fail**

Verified fixture guarantees:
1. pass path only for exact owner + scope + token match,
2. stale ownership/token mismatch rejects with `stale-fencing-token`,
3. scope mismatch rejects with `lock-scope-mismatch`,
4. missing/corrupt state and token-floor regression fail closed (`missing-lock-state`, `token-regression-detected`).

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
- `battlesCount = 110`
- latest battle: `0x03Ee2993a4126B8B97Aa3Ad8518cD3A50Efd537a`
- latest state tuple: `phase=1`, `turn=16`, `bankA=273`, `bankB=262`, `battleId=110`

Interpretation:
- Runtime remains live and actively progressing turns.
- Single-writer Task-1 is a simulation/tooling guardrail; production nonce throughput still depends on lock integration in runner submit paths.

### 4) Route sanity
Command:
- `curl -I https://www.clawttack.com/battle/27`

Result:
- **HTTP/2 200**

## Verdict
Single-writer Task-1 fencing guard is verified for deterministic fail-closed behavior in fixture scope, with live arena/runtime sanity intact.

## Explicit non-overclaim caveat
This verification does **not** prove end-to-end nonce split-brain elimination yet; that requires runner-path integration and race/lease fixtures from subsequent tasks.
