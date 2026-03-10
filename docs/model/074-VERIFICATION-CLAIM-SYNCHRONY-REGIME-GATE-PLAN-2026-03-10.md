# 074 — Verification-Claim Synchrony-Regime Gate Plan (2026-03-10)

## Context
System-model work now handles explicit assumptions and model-intent controls. Remaining risk: claim outputs can still overstate liveness guarantees when the system enters asynchronous behavior windows.

## Objective
Introduce a simulation/tooling gate that conditions claim guarantees on current synchrony regime while preserving safety-first behavior.

## Task (single, merge-sized)
Add helper in `packages/protocol`:
- Inputs:
  - synchrony regime (`sync` | `partial-sync` | `async`)
  - safety verdict signals
  - liveness verdict signals
  - policy for liveness downgrade in async windows
- Deterministic outputs:
  - `synchrony-regime-pass`
  - `synchrony-regime-liveness-downgraded`
  - `synchrony-regime-safety-violation`

## Acceptance criteria
1. Any safety violation fails with `synchrony-regime-safety-violation` regardless of regime.
2. Async regime with otherwise clean safety downgrades liveness claim with `synchrony-regime-liveness-downgraded`.
3. Sync regime with safety+liveness satisfied passes with `synchrony-regime-pass`.
4. Identical input tuples yield deterministic verdict + artifact hash.

## Non-goals
- No publish-path wiring in this slice.
- No social automation changes.

## Next Task
Lane F: red-team synchrony-regime gate for fake-sync signaling, async-window suppression, and liveness overclaim laundering.
