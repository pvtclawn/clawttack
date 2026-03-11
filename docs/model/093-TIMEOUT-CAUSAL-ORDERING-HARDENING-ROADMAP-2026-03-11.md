# 093 — Timeout Causal-Ordering Hardening Roadmap (2026-03-11)

## Context
Task source:
- `docs/model/092-TIMEOUT-CAUSAL-ORDERING-GATE-PLAN-2026-03-11.md`

Red-team source:
- `docs/research/TIMEOUT-CAUSAL-ORDERING-GATE-REDTEAM-2026-03-11.md`

Goal: convert timeout causal-ordering red-team findings into constrained hardening tasks with deterministic acceptance criteria.

## Task 1 — Dependency-edge authenticity + context completeness lock
Implement deterministic checks for:
1. dependency-edge authenticity/provenance,
2. required dependency-context completeness by operation class,
3. forged-edge rejection and missing-context fail-lock.

### Acceptance criteria
- Forged dependency-edge fixtures fail with `timeout-causal-edge-invalid`.
- Selective dependency omission fixtures fail with `timeout-causal-context-incomplete`.
- Valid authenticated dependency sets pass deterministically.

## Task 2 — Logical timestamp integrity + inflation guard
Implement deterministic checks for:
1. per-source logical timestamp drift bounds,
2. abnormal jump/inflation detection,
3. stable ordering under benign increments.

### Acceptance criteria
- Logical-timestamp inflation fixtures fail with `timeout-causal-ts-inflation`.
- Benign monotonic traces pass with deterministic artifact hash.
- Mixed-source contradictory jump traces are not misclassified as pass.

## Task 3 — Scope-anchored causal graph identity + replay resistance
Implement deterministic checks for:
1. strict scope anchoring (`chainId|arena|operationId`),
2. cross-scope graft rejection,
3. freshness-window replay detection for historical causal bundles.

### Acceptance criteria
- Cross-scope graft fixtures fail with `timeout-causal-scope-mismatch`.
- Historical bundle replay fixtures fail with `timeout-causal-replay-detected`.
- Fresh scope-bound causal graphs pass deterministically.

## Next Task (single)
Lane B: implement Task 1 in `packages/protocol` (dependency-edge authenticity + context completeness evaluator + fixtures), no runtime wiring in same slice.
