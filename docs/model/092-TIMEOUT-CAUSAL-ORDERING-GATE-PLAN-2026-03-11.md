# 092 — Timeout Causal-Ordering Gate Plan (2026-03-11)

## Context
Current timeout-classification work hardens source integrity and clock-source consistency, but still risks ordering errors when multiple evidence events are concurrent or only wall-time ordered.

Distributed-systems causal model:
- happened-before is a partial order,
- logical clocks encode causal progression,
- physical clocks alone are insufficient for correctness-critical ordering.

## Objective
Add deterministic causal-ordering checks for timeout evidence so classification can distinguish causal order from concurrency and detect causal violations.

## Task (single, merge-sized)
Implement simulation/tooling evaluator for timeout causal ordering:
- deterministic outcomes:
  - `timeout-causal-order-pass`
  - `timeout-causal-order-concurrent`
  - `timeout-causal-order-violation`

## Inputs
- evidence events with:
  - `eventId`, `nodeId`, `logicalTs`, `wallClockTs`,
  - optional predecessor/dependency set,
  - operation scope tuple (`chainId`, `arena`, `operationId`).

## Core rules
1. If dependencies are satisfied and logical order is consistent, emit `timeout-causal-order-pass`.
2. If neither event happened-before the other (partial-order concurrency), emit `timeout-causal-order-concurrent`.
3. If declared/inferred causal dependencies conflict with logical ordering, emit `timeout-causal-order-violation`.
4. Identical tuples must yield deterministic verdict + artifact hash.

## Acceptance criteria
1. Causally ordered fixture passes with `timeout-causal-order-pass`.
2. Concurrent fixture returns `timeout-causal-order-concurrent`.
3. Dependency/logical-order contradiction fixture fails with `timeout-causal-order-violation`.
4. Identical input tuples produce identical verdict and artifact hash.

## Non-goals
- No runtime scheduler rewiring in this slice.
- No on-chain schema changes in this slice.

## Next Task
Lane F: red-team timeout causal-ordering gate for forged dependency edges, logical-timestamp inflation, and concurrency laundering.
