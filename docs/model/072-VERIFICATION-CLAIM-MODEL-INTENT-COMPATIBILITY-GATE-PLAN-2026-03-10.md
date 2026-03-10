# 072 — Verification-Claim Model-Intent Compatibility Gate Plan (2026-03-10)

## Context
System-model work now emphasizes explicit assumptions (sync/async, timing semantics). Remaining risk: claim summaries still mix theoretical and practical confidence without explicit intent alignment.

## Objective
Introduce a simulation/tooling gate that enforces compatibility between claim intent and evidence intent class.

## Task (single, merge-sized)
Add helper in `packages/protocol`:
- Inputs:
  - claim intent (`theoretical-bound` | `practical-operational` | `hybrid-consensus`)
  - evidence intent bundle with coverage markers
  - compatibility policy matrix
- Deterministic outputs:
  - `model-intent-pass`
  - `model-intent-mismatch`
  - `model-intent-evidence-incomplete`

## Acceptance criteria
1. Practical-operational claim backed only by theoretical-bound evidence fails with `model-intent-mismatch`.
2. Claim with missing required intent coverage fails with `model-intent-evidence-incomplete`.
3. Intent-compatible, coverage-complete claim/evidence bundle passes with `model-intent-pass`.
4. Identical input tuples yield deterministic verdict + artifact hash.

## Non-goals
- No publish-path wiring in this slice.
- No social automation changes.

## Next Task
Lane F: red-team model-intent gate for intent-label spoofing, compatibility-matrix manipulation, and theoretical-to-practical overclaim laundering.
