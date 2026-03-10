# 058 — Verification-Claim Interaction Consistency Gate Plan (2026-03-10)

## Context
Module-level hardening has progressed (caveat quality, triangulation provenance/freshness, trace provenance/replay, safety+liveness task slices, responsiveness task slice). Remaining risk: emergent contradictions across modules.

## Objective
Introduce a simulation/tooling gate that validates **cross-module consistency** before allowing aggregate claim pass.

## Task (single, merge-sized)
Add helper in `packages/protocol`:
- Inputs:
  - module verdict bundle (caveat, triangulation, trace, safety/liveness, responsiveness)
  - expected consistency invariants (e.g., no pass if prerequisite module failed)
  - evidence completeness flags
- Deterministic outputs:
  - `interaction-consistency-pass`
  - `interaction-consistency-conflict`
  - `interaction-evidence-incomplete`

## Acceptance criteria
1. Any contradictory verdict tuple (e.g., aggregate pass while prerequisite module fails) returns `interaction-consistency-conflict`.
2. Missing required module evidence returns `interaction-evidence-incomplete`.
3. Consistent, complete module tuple returns `interaction-consistency-pass`.
4. Identical input tuple yields deterministic verdict + artifact hash.

## Non-goals
- No publish-path wiring in this slice.
- No social automation changes.

## Next Task
Lane F: red-team interaction-consistency gate for conflict-hiding aggregation, selective module omission, and reason-precedence manipulation.
