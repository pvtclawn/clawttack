# 062 — Verification-Claim Global Observability Gate Plan (2026-03-10)

## Context
Current guardrails cover many local/module properties (completeness, triangulation, trace, safety/liveness, responsiveness, interaction consistency, view consistency Task-1). Remaining risk: global/system claims accepted from insufficient distributed evidence.

## Objective
Introduce a simulation/tooling gate that enforces explicit distributed observability requirements for global-scope claims.

## Task (single, merge-sized)
Add helper in `packages/protocol`:
- Inputs:
  - claim scope (`local` | `holon` | `global`)
  - witness set from components/subsystems
  - network confidence signals (delivery freshness, quorum confidence, missing acknowledgements)
- Deterministic outputs:
  - `global-observability-pass`
  - `global-observability-insufficient-witnesses`
  - `global-observability-network-uncertain`

## Acceptance criteria
1. Global claim with fewer than required witness quorum fails with `global-observability-insufficient-witnesses`.
2. Global claim with stale/uncertain network confidence fails with `global-observability-network-uncertain`.
3. Properly witnessed + network-confident global claim passes with `global-observability-pass`.
4. Identical input tuples yield deterministic verdict + artifact hash.

## Non-goals
- No publish-path wiring in this slice.
- No social automation changes.

## Next Task
Lane F: red-team global-observability gate for forged witness quorum, acknowledgement spoofing, and stale-network confidence laundering.
