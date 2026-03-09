# 023 — Failure Injection Matrix Hardening Roadmap (2026-03-09)

Input artifact: `memory/challenges/2026-03-09--failure-injection-matrix-red-team.md`

## Goal
Convert failure-injection matrix red-team risks into merge-sized implementation tasks with explicit acceptance gates.

---

## Task 1 (P0): Anti-overfitting fixture strategy + context-complete replay hash

### Scope
- Add hidden rotating fixture set alongside public fixtures.
- Bind replay-hash preimage to full run context (`seed`, `schemaVersion`, `config`, `moduleSet`, `fixtureId`).
- Fail closed when context metadata is missing/incomplete.

### Acceptance criteria
1. Hidden-fixture pass rate is reported separately from public fixtures.
2. Identical fixture content with different context metadata yields different replay hashes.
3. Missing context fields trigger deterministic hard failure (`incomplete-run-context`).

---

## Task 2 (P0): Compound-failure coverage minimum

### Scope
- Extend matrix runner to include mandatory compound scenarios (at least one 2-way combination per module).
- Emit explicit coverage map of tested vs untested failure-class combinations.

### Acceptance criteria
1. Every guardrail module has >=1 compound failure fixture.
2. Coverage report is generated automatically in matrix output artifacts.
3. CI fails when compound coverage floor is unmet.

---

## Task 3 (P1): Liveness/precision co-gates + resource budget enforcement

### Scope
- Enforce liveness and reject-precision thresholds alongside determinism.
- Add fixture complexity budgets (runtime/memory caps) and timeout policy.
- Split heavy stress profile from default fast profile.

### Acceptance criteria
1. Deterministic-but-liveness-regressing runs fail gate.
2. Matrix runner rejects oversized fixtures before execution (`fixture-budget-exceeded`).
3. Stress profile can run independently without blocking default verification loop.

---

## Next Task (single)
Implement Task 1 first in simulation tooling (hidden/public fixture split + context-complete replay hash), with no production behavior changes in the same PR.
