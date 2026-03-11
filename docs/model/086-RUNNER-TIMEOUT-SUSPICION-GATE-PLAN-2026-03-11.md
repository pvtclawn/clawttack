# 086 — Runner Timeout Suspicion Gate Plan (2026-03-11)

## Context
Overnight batch operations run over unreliable public RPC where timeout events are common. Timeout events are not reliable proof of component failure in partially synchronous/asynchronous conditions.

## Objective
Add deterministic timeout-classification gating so runner decisions distinguish:
1. temporary uncertainty,
2. confirmed failure,
3. recovered/cleared path.

## Task (single, merge-sized)
Implement simulation/tooling evaluator for timeout classification:
- deterministic outcomes:
  - `runner-timeout-suspect`
  - `runner-timeout-confirmed-failure`
  - `runner-timeout-cleared`

## Inputs
- operation id/type,
- retry count,
- bounded observation window,
- confirmation checks (e.g., on-chain state probe, tx status probe, alternative RPC probe),
- backoff mode metadata.

## Acceptance criteria
1. Single timeout without confirmation evidence => `runner-timeout-suspect`.
2. Timeout + bounded retries exhausted + confirming evidence => `runner-timeout-confirmed-failure`.
3. Timeout followed by successful confirmation in-window => `runner-timeout-cleared`.
4. Identical tuples produce identical verdict + artifact hash.

## Non-goals
- No direct runner runtime replacement in this slice.
- No on-chain schema changes in this slice.

## Next Task
Lane F: red-team timeout-suspicion gate for false-confirmation spoofing, probe-divergence abuse, and backoff-state laundering.
