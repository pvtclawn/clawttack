# 103 — Timeout Bucket Monotonic-Knowledge Hardening Roadmap (2026-03-11)

## Context
Task source:
- `docs/model/102-TIMEOUT-BUCKET-MONOTONIC-KNOWLEDGE-GATE-PLAN-2026-03-11.md`

Red-team source:
- `docs/research/TIMEOUT-BUCKET-MONOTONIC-KNOWLEDGE-GATE-REDTEAM-2026-03-11.md`

Goal: convert monotonic-knowledge red-team findings into constrained hardening tasks with deterministic acceptance criteria.

## Task 1 — Authenticated monotonicity-claim validation + transitive regression lock
Implement deterministic checks for:
1. semantic claim validation against authenticated reducer capability map,
2. undeclared side-effect class mismatch hard-fail,
3. transitive side-effect closure checks for hidden regressions.

### Acceptance criteria
- Semantic under-reporting fixtures fail with `timeout-bucket-monotonicity-claim-invalid`.
- Hidden regression side-effect fixtures fail with `timeout-bucket-transitive-regression-detected`.
- Authenticated monotonic claim fixtures pass deterministically.

## Task 2 — Predicate coverage baseline + shared-predicate conflict guard
Implement deterministic checks for:
1. minimum predicate coverage profile per operation class,
2. under-scoped predicate set rejection,
3. cross-bucket shared-predicate conflict analysis.

### Acceptance criteria
- Predicate-set laundering fixtures fail with `timeout-bucket-predicate-coverage-incomplete`.
- Cross-bucket predicate interference fixtures fail with `timeout-bucket-shared-predicate-conflict`.
- Complete predicate coverage fixtures pass with stable artifact hash.

## Task 3 — Monotonicity verdict freshness/version binding
Implement deterministic checks for:
1. verdict binding to reducer semantic version/digest,
2. stale verdict replay rejection,
3. freshness-window validation for monotonicity artifacts.

### Acceptance criteria
- Stale monotonicity replay fixtures fail with `timeout-bucket-monotonicity-version-stale`.
- Fresh version-consistent verdicts pass deterministically.
- Identical tuples produce identical verdict and artifact hash.

## Next Task (single)
Lane B: implement Task 1 in `packages/protocol` (authenticated monotonicity-claim + transitive regression evaluator + fixtures), no runtime wiring in same slice.
