# 097 — Timeout Order-Equivalence Hardening Roadmap (2026-03-11)

## Context
Task source:
- `docs/model/096-TIMEOUT-ORDER-EQUIVALENCE-GATE-PLAN-2026-03-11.md`

Red-team source:
- `docs/research/TIMEOUT-ORDER-EQUIVALENCE-GATE-REDTEAM-2026-03-11.md`

Goal: convert timeout order-equivalence red-team findings into constrained hardening tasks with deterministic acceptance criteria.

## Task 1 — Constraint provenance + coverage completeness lock
Implement deterministic checks for:
1. precedence-constraint provenance/authenticity,
2. required constraint coverage completeness,
3. forged/incomplete constraint hard-fail paths.

### Acceptance criteria
- Forged-constraint fixtures fail with `timeout-order-constraint-invalid`.
- Selective-edge-drop fixtures fail with `timeout-order-constraint-incomplete`.
- Authenticated, complete constraint sets pass deterministically.

## Task 2 — Bucket-membership derivation integrity
Implement deterministic checks for:
1. bucket membership consistency with authenticated dependency context,
2. laundering detection for reclassified constrained events,
3. mismatch hard-fail path.

### Acceptance criteria
- Bucket-membership laundering fixtures fail with `timeout-order-bucket-membership-invalid`.
- Valid bucket derivations from authenticated context pass with stable artifact hash.
- Equivalent candidates do not pass with contradictory bucket assignment.

## Task 3 — Real-time metadata integrity + replay-resistance binding
Implement deterministic checks for:
1. nonconcurrent real-time precedence metadata integrity,
2. tampering/uncertain metadata handling discipline,
3. window/epoch nonce replay resistance for equivalence artifacts.

### Acceptance criteria
- Tampered real-time metadata fixtures fail with `timeout-order-real-time-metadata-invalid`.
- Cross-window artifact replay fixtures fail with `timeout-order-equivalence-replay`.
- Fresh, integrity-preserving equivalence artifacts pass deterministically.

## Next Task (single)
Lane B: implement Task 1 in `packages/protocol` (constraint provenance + coverage completeness evaluator + fixtures), no runtime wiring in same slice.
