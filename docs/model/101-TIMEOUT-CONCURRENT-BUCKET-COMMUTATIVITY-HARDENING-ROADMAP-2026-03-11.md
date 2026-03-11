# 101 — Timeout Concurrent-Bucket Commutativity Hardening Roadmap (2026-03-11)

## Context
Task source:
- `docs/model/100-TIMEOUT-CONCURRENT-BUCKET-COMMUTATIVITY-GATE-PLAN-2026-03-11.md`

Red-team source:
- `docs/research/TIMEOUT-CONCURRENT-BUCKET-COMMUTATIVITY-REDTEAM-2026-03-11.md`

Goal: convert concurrent-bucket commutativity red-team findings into constrained hardening tasks with deterministic acceptance criteria.

## Task 1 — Authenticated semantic-capability lock
Implement deterministic checks for:
1. reducer-derived semantic capability (commutative/idempotent) from authenticated version map,
2. self-declared semantic-flag mismatch hard-fail,
3. capability lookup integrity in evaluator scope.

### Acceptance criteria
- Semantic-flag spoof fixtures fail with `timeout-bucket-semantic-flag-invalid`.
- Authenticated capability-consistent fixtures pass deterministically.
- Identical tuples produce identical verdict + artifact hash.

## Task 2 — Witness completeness + pair-coverage guard
Implement deterministic checks for:
1. canonical witness schema with required side-effect/milestone fields,
2. branch coverage floor validation,
3. complete pair-matrix (or provably safe partition) enforcement.

### Acceptance criteria
- Witness-laundering fixtures fail `timeout-bucket-witness-incomplete`.
- Partial pair-check fixtures fail `timeout-bucket-pair-coverage-incomplete`.
- Fully covered witness sets pass with stable artifact hash.

## Task 3 — Milestone parity + retry-scope idempotence requirement
Implement deterministic checks for:
1. terminal + milestone/state-transition parity,
2. at-least-once/retry scope idempotence proof requirement,
3. non-idempotent retry-path fail lock.

### Acceptance criteria
- Terminal-only convergence with milestone divergence fails `timeout-bucket-milestone-divergence`.
- Retry-scope non-idempotent fixtures fail `timeout-bucket-idempotence-missing`.
- Commutative + idempotent retry-safe fixtures pass deterministically.

## Next Task (single)
Lane B: implement Task 1 in `packages/protocol` (authenticated semantic-capability lock evaluator + fixtures), no runtime wiring in same slice.
