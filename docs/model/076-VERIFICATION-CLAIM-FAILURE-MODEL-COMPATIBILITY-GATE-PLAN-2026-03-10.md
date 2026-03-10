# 076 — Verification-Claim Failure-Model Compatibility Gate Plan (2026-03-10)

## Context
System-model and synchrony-regime work now covers assumption framing and regime handling. Remaining risk: claims are still evaluated without explicit compatibility to component failure class (crash-stop/omission/crash-recovery/byzantine).

## Objective
Introduce a simulation/tooling gate that enforces failure-model compatibility between claim scope and evidence coverage.

## Task (single, merge-sized)
Add helper in `packages/protocol`:
- Inputs:
  - declared claim failure model (`crash-stop` | `omission` | `crash-recovery` | `byzantine`)
  - evidence failure-model coverage set
  - policy mapping for minimum evidence strength by failure class
- Deterministic outputs:
  - `failure-model-pass`
  - `failure-model-mismatch`
  - `failure-model-evidence-insufficient`

## Acceptance criteria
1. Claim with undeclared or incompatible failure model coverage fails with `failure-model-mismatch`.
2. Claim whose evidence strength is below required policy for declared failure class fails with `failure-model-evidence-insufficient`.
3. Compatible and sufficient failure-model evidence passes with `failure-model-pass`.
4. Identical input tuples yield deterministic verdict + artifact hash.

## Non-goals
- No publish-path wiring in this slice.
- No social automation changes.

## Next Task
Lane F: red-team failure-model gate for model downscoping, evidence-strength spoofing, and byzantine-claim laundering.
