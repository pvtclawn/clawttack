# 084 — Batch Runner Idempotence-Key Gate Plan (2026-03-11)

## Context
Overnight battle batching still faces retry turbulence under public RPC instability (timeouts/520s, replacement churn). Distributed-systems model says duplicates/reordering/loss are normal conditions, so safety must come from idempotent operation semantics, not fragile "single-shot" assumptions.

## Objective
Introduce deterministic idempotence-key gating for side-effecting batch operations so retries become safe and replayable.

## Task (single, merge-sized)
Add simulation/tooling evaluator for runner operation keys:
- operation classes:
  1. `create-battle`
  2. `accept-battle`
  3. `claim-timeout`
- deterministic outcomes:
  - `runner-op-pass`
  - `runner-op-duplicate-detected`
  - `runner-op-scope-mismatch`

## Key schema (v1)
`opKey = hash(chainId|arena|actor|operationType|battleScope|intentHash)`

Where:
- `battleScope` = (`battleId` for existing battle ops) OR (`targetSlot` for create-intent slotting)
- `intentHash` commits all operation-defining fields that must remain stable across retries.

## Acceptance criteria
1. Exact retry with same scope+intent returns deterministic duplicate verdict (`runner-op-duplicate-detected`) after first acceptance.
2. Scope-mutated replay (e.g., battleId/slot mismatch) fails with `runner-op-scope-mismatch`.
3. Legit new op with distinct scope+intent passes with `runner-op-pass`.
4. Identical tuples produce identical verdict + artifact hash.

## Non-goals
- No direct tx pipeline replacement in this slice.
- No on-chain schema changes in this slice.

## Next Task
Lane F: red-team idempotence-key gate for key-collision abuse, intent-hash laundering, and slot-scope confusion attacks.
