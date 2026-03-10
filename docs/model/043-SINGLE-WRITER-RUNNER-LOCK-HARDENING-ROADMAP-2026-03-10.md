# 043 — Single-Writer Runner Lock Hardening Roadmap (2026-03-10)

## Context
From red-team findings in:
- `docs/research/SINGLE-WRITER-RUNNER-LOCK-REDTEAM-2026-03-10.md`

Current batching pain is nonce split-brain under overlapping runners. A lock plan exists (`042`), but needs constrained hardening before broad adoption.

## Goal
Guarantee deterministic single-writer nonce ownership with safe recovery and scope correctness.

---

## Task 1 — Fencing-token enforcement on submit path (P0)
Bind every tx submission path to active fencing token ownership.

### Acceptance criteria
- stale token submit attempts fail with deterministic `stale-fencing-token`.
- token mismatch forces self-terminate path for stale runner.
- fixture shows no dual-writer successful submit in same scope.

---

## Task 2 — Atomic lock state + rollback/corruption detection (P0)
Harden lock artifact persistence and monotonic token invariants.

### Acceptance criteria
- lock writes use atomic write/rename semantics and schema versioning.
- token regression is detected with deterministic `token-regression-detected`.
- malformed/partial lock state fails closed with deterministic `lock-state-corrupt`.

---

## Task 3 — Canonical scope + lease-race safety (P1)
Prevent both bypass and overblocking while resolving lease races deterministically.

### Acceptance criteria
- canonical scope key enforced (`chainId:arena:wallet`).
- acquisition race fixture yields single winner (deterministic loser abort path).
- scope mismatch emits deterministic `lock-scope-mismatch` and prevents submit.

---

## Next Task (single)
Implement **Task 1** in runner tooling as a simulation-backed submit guard with deterministic reason codes; no broad refactor in same PR.
