# 094 — Timeout Logical-Order Normalization Gate Plan (2026-03-11)

## Context
Timeout causal-ordering work identifies valid partial-order concurrency, but downstream evaluators still need a deterministic normalized representation to avoid order flapping across retries/replays.

Logical-clock guidance:
- happened-before gives partial order,
- Lamport-style logical timestamps preserve causal progression,
- correctness depends on deterministic event ordering rules.

## Objective
Add deterministic normalization for timeout evidence ordering so equivalent causal histories map to the same canonical representation.

## Task (single, merge-sized)
Implement simulation/tooling evaluator for logical-order normalization:
- deterministic outcomes:
  - `timeout-logical-order-normalized`
  - `timeout-logical-order-concurrent-bucket`
  - `timeout-logical-order-inconsistent`

## Inputs
- events with `eventId`, `nodeId`, `logicalTs`, `operationId`, dependency/predecessor metadata.

## Core rules
1. Causally comparable events must be emitted in deterministic canonical order.
2. Causally incomparable events must be grouped into deterministic concurrent buckets.
3. Contradictory order metadata (e.g., cyclic or inconsistent logical relations) must fail deterministic with `timeout-logical-order-inconsistent`.
4. Identical tuples must yield identical normalized order/buckets + artifact hash.

## Acceptance criteria
1. Equivalent causal histories with different ingestion order produce identical normalized output.
2. Concurrent-event fixtures produce deterministic `concurrent-bucket` output.
3. Inconsistent/cyclic order fixtures fail with `timeout-logical-order-inconsistent`.
4. Identical input tuples produce identical verdict and artifact hash.

## Non-goals
- No runtime scheduler rewiring in this slice.
- No on-chain schema changes in this slice.

## Next Task
Lane F: red-team logical-order normalization gate for bucket poisoning, tie-break manipulation, and inconsistent-graph laundering.
