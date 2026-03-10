# 082 — Verification-Claim Membership-Epoch Counter Gate Plan (2026-03-10)

## Context
Task-1 membership-epoch checks now detect stale epochs and split-view quorum bundles. Remaining integration risk: replay of previously valid evidence within the same epoch.

## Objective
Add a deterministic monotonic-counter gate for membership-epoch evidence to prevent same-epoch replay and order-skipping abuse.

## Task (single, merge-sized)
Add helper in `packages/protocol`:
- Inputs:
  - `claimId`, `epochId`, `authoritySetId`
  - previous accepted counter
  - candidate evidence counter
  - optional max-gap policy
- Deterministic outputs:
  - `membership-epoch-counter-pass`
  - `membership-epoch-counter-replay`
  - `membership-epoch-counter-gap`

## Acceptance criteria
1. Replayed/old counter (`candidate <= previous`) fails with `membership-epoch-counter-replay`.
2. Counter jump beyond allowed gap fails with `membership-epoch-counter-gap`.
3. Strictly monotonic, policy-compliant counter passes with `membership-epoch-counter-pass`.
4. Identical input tuples yield deterministic verdict + artifact hash.

## Non-goals
- No publish-path wiring in this slice.
- No on-chain tx/schema changes in this slice.

## Next Task
Lane F: red-team membership-epoch counter gate for replay-window laundering, counter-reset spoofing, and gap-policy gaming.
