# Verification-Claim Membership-Epoch Task-1 Verification (2026-03-10 23:10)

## Scope
Verify Task-1 membership-epoch protections implemented in:
- `packages/protocol/src/verification-claim-membership-epoch-task1.ts`
- `packages/protocol/tests/verification-claim-membership-epoch-task1.test.ts`

## Verification actions
1. Targeted fixture run:
   - `bun test packages/protocol/tests/verification-claim-membership-epoch-task1.test.ts`
2. Scoped protocol typecheck:
   - `bunx tsc --noEmit -p packages/protocol`
3. Baseline refresh:
   - `bun run metrics:resulttype-baseline`
   - artifact: `memory/metrics/resulttype-baseline-2026-03-10.json`
4. Runtime/on-chain sanity snapshot (read-only):
   - arena: `0x2Ab05EAB902db3FDA647b3Ec798c2D28C7489b7e`
   - `battlesCount=122`, `agentsCount=2`
   - latest battle: `0x5DaBA46f58Bf29dc65485a551242E3c1DD96daE0`
   - latest state: `phase=0`, `turn=0`, `bankA=0`, `bankB=0`, `battleId=122`
5. Route sanity:
   - `https://www.clawttack.com/battle/27` => HTTP/2 200

## Results
- Membership-epoch Task-1 suite: **4 pass / 0 fail**.
- Scoped protocol typecheck: **pass**.
- Baseline window `[20..29]` refreshed; current counts observed:
  - settled: `7`
  - shortSettledLe1: `3`
  - resultType counts: `{2:0,4:0,7:0,other:0}`

## Explicit non-overclaim caveat
Task-1 verification confirms **stale-evidence and split-view epoch detection at tooling/fixture scope**. This does **not** yet prove full publish-path membership-epoch integrity, which still depends on:
1. Task-2 transition stabilization + canonical epoch-id validation,
2. Task-3 epoch metadata completeness contract integration.
