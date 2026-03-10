# Feedback-Cadence Task-1 Verification — 2026-03-10

## Scope
Verify the current Task-1 behavior for `feedback-cadence-budget` and refresh baseline/runtime consistency checks.

## Checks Run

### 1) Task-1 targeted test suite
Command:
- `bun test packages/protocol/tests/feedback-cadence-budget.test.ts`

Result:
- **2 passed / 2 failed**
- Failing assertions:
  - rolling-window over-budget flag expected `true`, got `false`
  - near-threshold warning expected `cadence-warning`, got `cadence-ok`

Interpretation:
- Task-1 implementation currently under-detects two expected risk cases (burst-splitting and near-threshold warning escalation).

### 2) Settled-window baseline refresh
Command:
- `bun run metrics:resulttype-baseline`

Artifact refreshed:
- `memory/metrics/resulttype-baseline-2026-03-10.json`

Current baseline snapshot:
- range: `[20, 29]`
- settled: `7`
- shortSettledLe1: `3`
- resultTypeCounts: `{2:1, 4:3, 7:2, other:1}`

### 3) Production direct-link route consistency
Command:
- `curl -I https://www.clawttack.com/battle/27`

Result:
- **HTTP/2 200**

### 4) Live on-chain runtime sanity
Commands:
- `cast call <arena> "battlesCount()(uint256)"`
- `cast call <arena> "battles(uint256)(address)" <latest>`
- `cast call <battle> "getBattleState()(uint8,uint32,uint128,uint128,bytes32,uint256)"`

Result:
- battlesCount: `3`
- latest battle: `0x9a6Ec0eFD69F60D48b336d4a5C0B0809B4C177E9`
- getBattleState: `phase=1`, `turn=16`, banks=`182/165`, battleId=`3`

Interpretation:
- New arena is live and autonomous battle loop is producing active on-chain turns.

## Verdict
- **Attention required:** feedback-cadence Task-1 currently fails 2 targeted verification cases.
- Baseline and production route checks are stable.
- On-chain battle execution is active on new deployment.
