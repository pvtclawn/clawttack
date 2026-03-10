# 064 — Verification-Claim Delivery-Semantics Gate Plan (2026-03-10)

## Context
Current guardrails focus heavily on verdict integrity and evidence scope. Remaining risk: transport-level anomalies (loss/duplication/reordering) can still distort global claim correctness.

## Objective
Introduce a simulation/tooling gate that evaluates claim-processing safety under message-delivery anomalies.

## Task (single, merge-sized)
Add helper in `packages/protocol`:
- Inputs:
  - claim envelope sequence metadata (counter, previous hash, receive order)
  - delivery anomaly indicators (duplicate seen, out-of-order depth, missing-ack timer)
  - policy bounds for duplicate/reorder/loss uncertainty
- Deterministic outputs:
  - `delivery-semantics-pass`
  - `delivery-duplicate-risk`
  - `delivery-reorder-risk`
  - `delivery-loss-uncertain`

## Acceptance criteria
1. Duplicate envelope fixture over policy bound fails with `delivery-duplicate-risk`.
2. Out-of-order depth over policy bound fails with `delivery-reorder-risk`.
3. Missing-ack timeout uncertainty over bound fails with `delivery-loss-uncertain`.
4. Within-bound delivery sequence passes with `delivery-semantics-pass`.
5. Identical input tuples yield deterministic verdict + artifact hash.

## Non-goals
- No publish-path wiring in this slice.
- No social automation changes.

## Next Task
Lane F: red-team delivery-semantics gate for duplicate replay storms, reorder-window gaming, and induced-loss ambiguity abuse.
