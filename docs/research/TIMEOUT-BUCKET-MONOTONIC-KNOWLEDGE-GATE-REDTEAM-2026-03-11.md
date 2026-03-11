# Timeout Bucket Monotonic-Knowledge Gate — Red-Team Report (2026-03-11)

## Scope
Target plan:
- `docs/model/102-TIMEOUT-BUCKET-MONOTONIC-KNOWLEDGE-GATE-PLAN-2026-03-11.md`

Goal: identify how monotonic-knowledge checks can be bypassed so regression-capable operations pass as safe concurrent-bucket members.

## Findings

### 1) Semantic under-reporting
**Vector:** operation declares itself monotonic while omitting regression-capable side effects in metadata.

**Failure mode:** evaluator emits `timeout-bucket-monotonic-pass` for operations that can invalidate prior safety predicates.

**Mitigation:** bind semantic claims to authenticated reducer capability map and reject undeclared side-effect classes (`timeout-bucket-monotonicity-claim-invalid`).

---

### 2) Predicate-set laundering
**Vector:** attacker narrows tracked predicate set to exclude predicates that could regress.

**Failure mode:** bucket appears monotonic only because sensitive predicates were omitted from scope.

**Mitigation:** require minimum predicate coverage profile per operation class and fail under-scoped predicate sets (`timeout-bucket-predicate-coverage-incomplete`).

---

### 3) Hidden regression side-effects
**Vector:** operation has secondary effects (e.g., reset counters, clear flags) that indirectly invalidate prior conclusions while primary effect looks monotonic.

**Failure mode:** monotonicity classification ignores transitive regressions.

**Mitigation:** include transitive side-effect closure checks and fail hidden regressions (`timeout-bucket-transitive-regression-detected`).

---

### 4) Cross-bucket predicate interference
**Vector:** operation in one bucket mutates shared predicate space used by another bucket’s monotonic reasoning.

**Failure mode:** per-bucket monotonic checks pass independently, but combined effect causes regression.

**Mitigation:** add shared-predicate conflict analysis across concurrently evaluated buckets (`timeout-bucket-shared-predicate-conflict`).

---

### 5) Monotonicity replay drift
**Vector:** replay old monotonicity verdict after reducer semantics evolve, without revalidating claims against new reducer map.

**Failure mode:** stale monotonic pass remains accepted under changed semantics.

**Mitigation:** version-bind monotonicity verdicts and reject stale semantic-evidence pairings (`timeout-bucket-monotonicity-version-stale`).

## Proposed hardening tasks
1. Authenticated semantic-claim validation + transitive side-effect closure checks.
2. Predicate coverage baseline + shared-predicate conflict analysis.
3. Version-bound monotonicity verdict freshness checks.

## Acceptance criteria for next lane
- Semantic under-reporting fixtures fail `timeout-bucket-monotonicity-claim-invalid`.
- Predicate laundering fixtures fail `timeout-bucket-predicate-coverage-incomplete`.
- Hidden regression fixtures fail `timeout-bucket-transitive-regression-detected`.
- Cross-bucket predicate interference fixtures fail `timeout-bucket-shared-predicate-conflict`.
- Stale monotonicity verdict replay fixtures fail `timeout-bucket-monotonicity-version-stale`.
