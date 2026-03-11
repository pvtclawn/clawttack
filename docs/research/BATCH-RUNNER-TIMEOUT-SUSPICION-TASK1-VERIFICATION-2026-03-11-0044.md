# Batch Runner Timeout-Suspicion Task-1 Verification (2026-03-11 00:44)

## Scope
Verify Task-1 probe-independence + anti-correlation protections implemented in:
- `packages/protocol/src/batch-runner-timeout-suspicion-task1.ts`
- `packages/protocol/tests/batch-runner-timeout-suspicion-task1.test.ts`

## Verification actions
1. Targeted fixture run:
   - `bun test packages/protocol/tests/batch-runner-timeout-suspicion-task1.test.ts`
2. Scoped protocol typecheck:
   - `bunx tsc --noEmit -p packages/protocol`
3. Baseline refresh:
   - `bun run metrics:resulttype-baseline`
   - artifact: `memory/metrics/resulttype-baseline-2026-03-11.json`
4. Runtime/on-chain sanity snapshot (read-only):
   - arena: `0x2Ab05EAB902db3FDA647b3Ec798c2D28C7489b7e`
   - `battlesCount=137`, `agentsCount=2`
   - latest battle: `0x055A1dfC6f0DD8167238E7c3B9796a64E35599D4`
   - latest state: `phase=1`, `turn=1`, `bankA=369`, `bankB=400`, `battleId=137`
5. Route sanity:
   - `https://www.clawttack.com/battle/27` => HTTP/2 200

## Results
- Timeout-suspicion Task-1 suite: **4 pass / 0 fail**.
- Scoped protocol typecheck: **pass**.
- Baseline window `[20..29]` refreshed (snapshot persisted in `resulttype-baseline-2026-03-11.json`).

## Explicit non-overclaim caveat
Task-1 verification confirms **probe-independence + anti-correlation checks at tooling/fixture scope**. This does **not** yet prove full runner-runtime timeout classification integrity. Remaining dependency is unchanged:
1. Task-2 divergence precedence + backoff-state integrity integration,
2. Task-3 anti-flap hysteresis + weighted recovery quorum integration.
