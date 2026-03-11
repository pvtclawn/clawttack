# 096 — Timeout Order-Equivalence Gate Plan (2026-03-11)

## Context
Logical-order normalization currently produces deterministic outputs, but validation still risks conflating:
- one exact normalized sequence,
- the full set of sequences equivalent under concurrency/causality constraints.

Distributed-systems consistency guidance:
- concurrent interleavings may differ yet remain semantically equivalent,
- serializability focuses on equivalence to an allowed sequential/constrained history,
- nonconcurrent real-time order constraints must be preserved.

## Objective
Add deterministic equivalence-class validation for timeout normalized output so acceptable alternative normalizations are recognized while violating orders are rejected.

## Task (single, merge-sized)
Implement simulation/tooling evaluator for timeout order equivalence:
- deterministic outcomes:
  - `timeout-order-equivalent`
  - `timeout-order-non-equivalent`
  - `timeout-order-real-time-violation`

## Inputs
- canonical constraint set:
  - happened-before edges,
  - nonconcurrent real-time precedence edges,
  - concurrency bucket membership,
- candidate normalized order (or bucketed order).

## Core rules
1. Candidate order is equivalent if all required precedence constraints are preserved.
2. Candidate order violating nonconcurrent real-time precedence fails with `timeout-order-real-time-violation`.
3. Candidate order violating causal/concurrency constraints fails with `timeout-order-non-equivalent`.
4. Identical input tuples must yield identical verdict + artifact hash.

## Acceptance criteria
1. Two distinct but valid equivalent orderings both pass as `timeout-order-equivalent`.
2. Real-time precedence violation fixture fails `timeout-order-real-time-violation`.
3. Causal-order violation fixture fails `timeout-order-non-equivalent`.
4. Identical tuples produce deterministic verdict and artifact hash.

## Non-goals
- No runtime scheduler rewiring in this slice.
- No on-chain schema changes in this slice.

## Next Task
Lane F: red-team timeout order-equivalence gate for forged precedence constraints, bucket-membership laundering, and selective edge dropping.
