# 066 — Verification-Claim Local-Authority Coordination Gate Plan (2026-03-10)

## Context
Guardrails now cover many local/module properties. Remaining risk: one local verifier path can still be over-elevated into global pass authority.

## Objective
Introduce a simulation/tooling gate that enforces deterministic global coordination from local module authorities, preventing split-brain style pass conflicts.

## Task (single, merge-sized)
Add helper in `packages/protocol`:
- Inputs:
  - local authority verdicts (module, verdict, confidence, authority class)
  - global coordination policy (quorum, tie-break, conflict-hardfail rules)
  - required authority classes for global decision
- Deterministic outputs:
  - `global-coordination-pass`
  - `global-coordination-conflict`
  - `global-coordination-insufficient-local-quorum`

## Acceptance criteria
1. Conflicting local authorities asserting incompatible global outcomes fail with `global-coordination-conflict`.
2. Missing required local authority quorum fails with `global-coordination-insufficient-local-quorum`.
3. Policy-compliant local authority bundle yields `global-coordination-pass`.
4. Identical input tuples yield deterministic verdict + artifact hash.

## Non-goals
- No publish-path wiring in this slice.
- No social automation changes.

## Next Task
Lane F: red-team local-authority coordination gate for authority spoofing, quorum-padding, and conflict-precedence manipulation.
