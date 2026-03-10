# 060 — Verification-Claim View-Consistency Gate Plan (2026-03-10)

## Context
Current guardrails verify multiple module-level properties. Remaining risk: local/module evidence can be unintentionally over-generalized into global/system certainty.

## Objective
Introduce a simulation/tooling gate that enforces claim/evidence consistency across **local, holon, and global** evidence views.

## Task (single, merge-sized)
Add helper in `packages/protocol`:
- Inputs:
  - claim scope level (`local` | `holon` | `global`)
  - evidence bundle with tagged view levels
  - required minimum view policy per claim scope
- Deterministic outputs:
  - `view-consistency-pass`
  - `global-claim-local-evidence-mismatch`
  - `view-evidence-incomplete`

## Acceptance criteria
1. Claim with `global` scope and only local evidence fails with `global-claim-local-evidence-mismatch`.
2. Claim with missing required view tags fails with `view-evidence-incomplete`.
3. Properly scoped claim with required tagged evidence passes with `view-consistency-pass`.
4. Identical input tuples yield deterministic verdict + artifact hash.

## Non-goals
- No publish-path wiring in this slice.
- No social automation changes.

## Next Task
Lane F: red-team view-consistency gate for view-tag spoofing, scope inflation, and local-to-global evidence laundering.
