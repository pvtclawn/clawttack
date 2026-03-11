# Timeout Clock-Source Task-1 Verification (2026-03-11 01:34)

## Scope
Verify Task-1 monotonic provenance + mixed-source ordering protections implemented in:
- `packages/protocol/src/timeout-clock-source-task1.ts`
- `packages/protocol/tests/timeout-clock-source-task1.test.ts`

## Verification actions
1. Targeted fixture run:
   - `bun test packages/protocol/tests/timeout-clock-source-task1.test.ts`
2. Scoped protocol typecheck:
   - `bunx tsc --noEmit -p packages/protocol`
3. Baseline refresh:
   - `bun run metrics:resulttype-baseline`
   - artifact: `memory/metrics/resulttype-baseline-2026-03-11.json`
4. Runtime/on-chain sanity snapshot (read-only):
   - arena: `0x2Ab05EAB902db3FDA647b3Ec798c2D28C7489b7e`
   - `battlesCount=143`, `agentsCount=2`
   - latest battle: `0x7aef3ce256686a09a694c5B21936E02F9684f394`
   - latest state: `phase=1`, `turn=24`, `bankA=113`, `bankB=34`, `battleId=143`
5. Route sanity:
   - `https://www.clawttack.com/battle/27` => HTTP/2 200

## Results
- Timeout clock-source Task-1 suite: **4 pass / 0 fail**.
- Scoped protocol typecheck: **pass**.
- Baseline window `[20..29]` refreshed (snapshot persisted in `resulttype-baseline-2026-03-11.json`).

## Explicit non-overclaim caveat
Task-1 verification confirms **monotonic provenance + mixed-source ordering checks at tooling/fixture scope**. This does **not** yet prove full runner-runtime clock-source integrity. Remaining dependency is unchanged:
1. Task-2 sync-proof authenticity + cross-node uncertainty discipline,
2. Task-3 rollover regression + coverage completeness guard integration.
