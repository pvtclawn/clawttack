# 104 — Timeout Safety-Priority Decision Gate Plan (2026-03-11)

## Context
Current timeout hardening improves evidence quality and ordering, but final decision policy still needs explicit safety/liveness prioritization under uncertainty.

Distributed-systems lesson:
- under uncertainty, prioritize safety over liveness,
- naive timeout-abort behavior can violate safety when clocks/network views diverge,
- blocking/holding is acceptable when required to avoid contradictory outcomes.

## Objective
Add deterministic safety-priority timeout decision checks so ambiguous evidence produces safe hold behavior instead of unsafe irreversible decisions.

## Task (single, merge-sized)
Implement simulation/tooling evaluator for timeout safety-priority decisions:
- deterministic outcomes:
  - `timeout-safety-priority-pass`
  - `timeout-safety-priority-hold`
  - `timeout-safety-priority-violation`

## Inputs
- evidence confidence score,
- cross-source agreement level,
- contradiction risk score,
- action candidate (`proceed`, `hold`, `abort`).

## Core rules
1. If contradiction risk is above threshold, non-hold decisions fail with `timeout-safety-priority-violation`.
2. If confidence/agreement is insufficient but contradiction risk is nontrivial, emit `timeout-safety-priority-hold`.
3. Only high-confidence, low-contradiction decisions pass as `timeout-safety-priority-pass`.
4. Identical tuples must yield deterministic verdict + artifact hash.

## Acceptance criteria
1. High contradiction-risk fixture with non-hold action fails `timeout-safety-priority-violation`.
2. Ambiguous-confidence fixture returns `timeout-safety-priority-hold`.
3. High-confidence/low-risk fixture passes `timeout-safety-priority-pass`.
4. Identical tuples produce deterministic verdict and artifact hash.

## Non-goals
- No runtime coordinator replacement in this slice.
- No on-chain schema changes in this slice.

## Next Task
Lane F: red-team safety-priority decision gate for risk-score laundering, confidence inflation, and contradictory-source masking.
