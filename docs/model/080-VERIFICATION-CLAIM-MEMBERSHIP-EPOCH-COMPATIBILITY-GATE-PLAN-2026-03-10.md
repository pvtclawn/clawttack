# 080 — Verification-Claim Membership-Epoch Compatibility Gate Plan (2026-03-10)

## Context
Current verification work includes authority/quorum, origin, and synchrony checks. Remaining risk: these checks may still rely on inconsistent or stale membership views when participant sets change.

## Objective
Introduce a simulation/tooling gate that enforces membership-epoch compatibility for claim evidence and authority/quorum decisions.

## Task (single, merge-sized)
Add helper in `packages/protocol`:
- Inputs:
  - claim membership epoch id
  - evidence membership epoch ids
  - membership transition policy (join/leave stabilization rules)
- Deterministic outputs:
  - `membership-epoch-pass`
  - `membership-epoch-mismatch`
  - `membership-epoch-evidence-incomplete`

## Acceptance criteria
1. Claim/evidence epoch mismatch fails with `membership-epoch-mismatch`.
2. Missing epoch metadata for required evidence fails with `membership-epoch-evidence-incomplete`.
3. Epoch-consistent, policy-compliant bundle passes with `membership-epoch-pass`.
4. Identical input tuples yield deterministic verdict + artifact hash.

## Non-goals
- No publish-path wiring in this slice.
- No social automation changes.

## Next Task
Lane F: red-team membership-epoch gate for stale-epoch laundering, split-view quorum spoofing, and join/leave transition abuse.
