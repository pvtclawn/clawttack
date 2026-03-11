# 095 — Timeout Logical-Order Normalization Hardening Roadmap (2026-03-11)

## Context
Task source:
- `docs/model/094-TIMEOUT-LOGICAL-ORDER-NORMALIZATION-GATE-PLAN-2026-03-11.md`

Red-team source:
- `docs/research/TIMEOUT-LOGICAL-ORDER-NORMALIZATION-REDTEAM-2026-03-11.md`

Goal: convert logical-order normalization red-team findings into constrained hardening tasks with deterministic acceptance criteria.

## Task 1 — Bucket-quality + tie-break integrity guard
Implement deterministic checks for:
1. concurrent-bucket poisoning resistance,
2. critical-event precedence labeling,
3. semantics-aware canonical tie-break enforcement.

### Acceptance criteria
- Bucket-poisoning fixtures fail with `timeout-logical-bucket-poisoned`.
- Tie-break manipulation fixtures fail with `timeout-logical-tiebreak-invalid`.
- Valid normalized sets with canonical tie-break keys pass deterministically.

## Task 2 — Graph completeness + inconsistency hard-fail
Implement deterministic checks for:
1. dependency-edge completeness threshold,
2. inconsistent/cyclic graph detection,
3. anti-laundering guard for partial-edge submissions.

### Acceptance criteria
- Partial-edge laundering fixtures fail with `timeout-logical-graph-incomplete`.
- Inconsistent graph fixtures fail with `timeout-logical-order-inconsistent`.
- Complete consistent graphs produce stable normalized output.

## Task 3 — Scope anchoring + normalization replay protection
Implement deterministic checks for:
1. strict scope anchoring (`chainId|arena|operationId`) per normalized event,
2. cross-scope graft rejection,
3. window/epoch nonce replay-resistance for normalized output artifacts.

### Acceptance criteria
- Cross-scope graft fixtures fail with `timeout-logical-scope-mismatch`.
- Normalization replay fixtures fail with `timeout-logical-normalization-replay`.
- Fresh scope-bound normalized outputs pass with deterministic artifact hash.

## Next Task (single)
Lane B: implement Task 1 in `packages/protocol` (bucket-quality + tie-break integrity evaluator + fixtures), no runtime wiring in same slice.
