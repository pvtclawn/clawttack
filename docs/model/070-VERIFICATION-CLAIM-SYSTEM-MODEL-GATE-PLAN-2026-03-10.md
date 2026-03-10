# 070 — Verification-Claim System-Model Gate Plan (2026-03-10)

## Context
Verification-claim hardening has added multiple deterministic guards. Remaining risk: correctness claims are made without explicit distributed-system model assumptions.

## Objective
Introduce a simulation/tooling gate that requires explicit system-model profile compatibility for claim acceptance.

## Task (single, merge-sized)
Add helper in `packages/protocol`:
- Inputs:
  - claim model profile (e.g., `sync-strict`, `partial-sync`, `async-lossy`)
  - evidence model profile(s)
  - compatibility matrix/version
- Deterministic outputs:
  - `system-model-pass`
  - `system-model-mismatch`
  - `system-model-unspecified`

## Acceptance criteria
1. Claim with missing model profile fails with `system-model-unspecified`.
2. Claim/evidence model incompatibility fails with `system-model-mismatch`.
3. Model-compatible claim/evidence bundle passes with `system-model-pass`.
4. Identical input tuples yield deterministic verdict + artifact hash.

## Non-goals
- No publish-path wiring in this slice.
- No social automation changes.

## Next Task
Lane F: red-team system-model gate for profile spoofing, compatibility-matrix drift, and cross-model overclaiming.
