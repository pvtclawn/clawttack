# Batch Runner Idempotence Task-1 Verification (2026-03-11 00:19)

## Scope
Verify Task-1 intent-binding + schema-lock protections implemented in:
- `packages/protocol/src/batch-runner-idempotence-task1.ts`
- `packages/protocol/tests/batch-runner-idempotence-task1.test.ts`

## Verification actions
1. Targeted fixture run:
   - `bun test packages/protocol/tests/batch-runner-idempotence-task1.test.ts`
2. Scoped protocol typecheck:
   - `bunx tsc --noEmit -p packages/protocol`
3. Baseline refresh:
   - `bun run metrics:resulttype-baseline`
   - artifact: `memory/metrics/resulttype-baseline-2026-03-11.json`
4. Runtime/on-chain sanity snapshot (read-only):
   - arena: `0x2Ab05EAB902db3FDA647b3Ec798c2D28C7489b7e`
   - `battlesCount=127`, `agentsCount=2`
   - latest battle: `0x0B797A779FBB9c0E33C8A2afaCc3316B9B9410E4`
   - latest state: `phase=1`, `turn=24`, `bankA=153`, `bankB=68`, `battleId=127`
5. Route sanity:
   - `https://www.clawttack.com/battle/27` => HTTP/2 200

## Results
- Idempotence Task-1 suite: **4 pass / 0 fail**.
- Scoped protocol typecheck: **pass**.
- Baseline window `[20..29]` refreshed with current snapshot values in `resulttype-baseline-2026-03-11.json`.

## Explicit non-overclaim caveat
Task-1 verification confirms **intent-binding integrity + schema-lock checks at tooling/fixture scope**. This does **not** yet prove full runner-runtime idempotence safety. Remaining dependency is unchanged:
1. Task-2 scope/domain canonicalization + collision-hardening integration,
2. Task-3 concurrent conflict reducer + retention/tombstone policy integration.
