# 078 — Verification-Claim Failure-Origin Compatibility Gate Plan (2026-03-10)

## Context
Failure-model and delivery-semantics guards exist, but claims can still blur **component-origin** vs **network-origin** resilience in a single summary.

## Objective
Introduce a simulation/tooling gate that enforces compatibility between claimed resilience origin and evidence origin coverage.

## Task (single, merge-sized)
Add helper in `packages/protocol`:
- Inputs:
  - declared claim failure origin scope (`component` | `network` | `mixed`)
  - evidence origin coverage tags
  - minimum required origin coverage policy
- Deterministic outputs:
  - `failure-origin-pass`
  - `failure-origin-mismatch`
  - `failure-origin-evidence-incomplete`

## Acceptance criteria
1. Component-only evidence for network-origin claim fails with `failure-origin-mismatch`.
2. Mixed-origin claim missing one required origin fails with `failure-origin-evidence-incomplete`.
3. Origin-compatible and coverage-complete claim/evidence bundle passes with `failure-origin-pass`.
4. Identical input tuples yield deterministic verdict + artifact hash.

## Non-goals
- No publish-path wiring in this slice.
- No social automation changes.

## Next Task
Lane F: red-team failure-origin gate for origin-tag spoofing, mixed-origin overclaiming, and selective-origin omission laundering.
