# 054 — Verification-Claim Correctness Plan: Safety + Liveness (2026-03-10)

## Context
Verification-claim hardening now includes Task-1 modules for:
- caveat quality,
- triangulation provenance/freshness,
- trace provenance/replay checks.

These are mostly **safety-heavy** controls. Remaining risk: workflows that avoid bad states but do not converge reliably.

## Objective
Introduce a simulation/tooling correctness gate that jointly evaluates:
1. **Safety** (no invalid claim transitions), and
2. **Liveness** (bounded convergence to terminal verdict).

## Task (single, merge-sized)
Add helper in `packages/protocol`:
- Input:
  - claim workflow state trace (step reasons + timestamps + terminal flag)
  - max allowed pending steps/time window
  - safety violations observed (if any)
- Output deterministic reasons:
  - `claim-correctness-pass`
  - `claim-safety-violation`
  - `claim-liveness-timeout`

## Acceptance criteria
1. Any safety violation in workflow trace fails deterministically with `claim-safety-violation`.
2. Workflow with no terminal verdict within bounded step/time window fails with `claim-liveness-timeout`.
3. Workflow with no safety violations and bounded convergence passes with `claim-correctness-pass`.
4. Identical workflow input tuple returns deterministic verdict + artifact hash.

## Non-goals
- No publish-path wiring in this slice.
- No social automation changes.

## Next Task
Lane F: red-team safety+liveness correctness gate for false-terminal spoofing, timer gaming, and partial-trace omission attacks.
