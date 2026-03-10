# 041 — State-Convergence Confirmation Hardening Roadmap (2026-03-10)

## Context
Following red-team findings in:
- `docs/research/STATE-CONVERGENCE-CONFIRMATION-REDTEAM-2026-03-10.md`

The base confirmation-gate plan (`040`) needs stricter determinism and liveness safeguards before any production-grade success-state promotion.

## Goal
Harden confirmation logic so battle-critical transitions are:
1) reorg-safe,
2) stale-evidence resistant,
3) deterministic under asynchronous evidence arrival,
while preserving liveness through explicit degraded-pending semantics.

---

## Task 1 — Deterministic reorg downgrade policy (P0)
Define a strict transition reducer and precedence table for post-confirmation conflicts.

### Acceptance criteria
- Reorg/conflict fixtures produce deterministic downgrade reason ordering (`reorg-detected` > `state-mismatch` > `indexer-stale`).
- Identical evidence sets replay to identical transition sequence IDs.
- No path emits terminal success below configured confirmation threshold.

---

## Task 2 — Freshness-bound dual-channel convergence gate (P0)
Require both channels (`event` + expected value mutation) with explicit freshness bounds.

### Acceptance criteria
- Event-only or value-only fixtures fail with deterministic `partial-convergence` reason.
- Stale evidence fixture fails with deterministic `evidence-stale` reason.
- Fresh dual-channel fixture unlocks only when confidence threshold is already satisfied.

---

## Task 3 — Liveness-safe degraded pending mode (P1)
Introduce bounded degraded-pending semantics under infra degradation without mislabeling success.

### Acceptance criteria
- After bounded retries/age, status transitions to deterministic `awaiting-convergence-degraded` (not success).
- Degraded state always includes explicit operator/action hint metadata.
- Recovery from degraded to confirmed remains deterministic when valid fresh evidence arrives.

---

## Next Task (single)
Implement **Task 1** as simulation-only utility + fixtures in `packages/protocol` (deterministic transition reducer + downgrade precedence), with no production settlement wiring in the same PR.
