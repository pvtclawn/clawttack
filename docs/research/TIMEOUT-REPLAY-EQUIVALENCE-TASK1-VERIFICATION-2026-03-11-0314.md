# Timeout Replay-Equivalence Task-1 Verification (2026-03-11 03:14)

## Scope
Verify Task-1 reducer identity/version lock + context tuple equality protections implemented in:
- `packages/protocol/src/timeout-replay-equivalence-task1.ts`
- `packages/protocol/tests/timeout-replay-equivalence-task1.test.ts`

## Verification actions
1. Targeted fixture run:
   - `bun test packages/protocol/tests/timeout-replay-equivalence-task1.test.ts`
2. Scoped protocol typecheck:
   - `bunx tsc --noEmit -p packages/protocol`
3. Baseline refresh:
   - `bun run metrics:resulttype-baseline`
   - artifact: `memory/metrics/resulttype-baseline-2026-03-11.json`
4. Runtime/on-chain sanity snapshot (read-only):
   - arena: `0x2Ab05EAB902db3FDA647b3Ec798c2D28C7489b7e`
   - `battlesCount=154`, `agentsCount=2`
   - latest battle: `0xa0D83603A732754ADc4115fd8A16ea13DB9b6Ab6`
   - latest state: `phase=1`, `turn=26`, `bankA=63`, `bankB=48`, `battleId=154`
5. Route sanity:
   - `https://www.clawttack.com/battle/27` => HTTP/2 200

## Results
- Timeout replay-equivalence Task-1 suite: **4 pass / 0 fail**.
- Scoped protocol typecheck: **pass**.
- Baseline window `[20..29]` refreshed (snapshot persisted in `resulttype-baseline-2026-03-11.json`).

## Explicit non-overclaim caveat
Task-1 verification confirms **reducer digest lock + context tuple equality checks at tooling/fixture scope**. This does **not** yet prove full runner-runtime replay-equivalence integrity. Remaining dependency is unchanged:
1. Task-2 canonical structured trace integrity guard,
2. Task-3 deterministic-input contract + nondeterministic denylist integration.
