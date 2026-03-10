# 052 — Verification-Claim Trace State-Machine Plan (2026-03-10)

## Context
Task-1 modules exist for:
- semantic caveat quality,
- triangulation provenance + freshness.

Remaining risk: verdicts can still be communicated as a single terminal status, obscuring decision path integrity.

## Objective
Require deterministic, step-indexed transition traces for verification-claim gate execution so every verdict is replayable as a small state machine.

## Task (single, merge-sized)
Add simulation/tooling helper in `packages/protocol`:
- Inputs:
  - claim id
  - ordered steps with step index, input hash, reason, output hash
- Validation rules:
  1. step indexes must be contiguous and monotonic,
  2. required steps present (`ingest`, `caveat`, `triangulation`, `aggregate`),
  3. aggregate step must reference prior output hash chain.
- Deterministic reasons:
  - `claim-gate-trace-pass`
  - `claim-gate-trace-invalid`
  - `claim-gate-trace-missing-step`
  - `claim-gate-trace-hash-chain-broken`

## Acceptance criteria
1. Trace with skipped index fails deterministically.
2. Trace missing one required phase fails deterministically.
3. Trace with broken hash-chain fails deterministically.
4. Identical valid trace input returns same verdict + artifact hash.

## Non-goals
- No production publish-path wiring in this slice.
- No social-post automation changes.

## Next Task
Lane F: red-team trace-state-machine gate for forged intermediate steps, replayed step bundles, and selective-step omission attacks.
