# 040 — State-Convergence Confirmation Gate Plan (2026-03-10)

## Context
From `books_and_papers/004_building_ethereum_products_and_protocols.pdf`:
- block inclusion can be reorganized,
- indexer/websocket delays can cause "tx success" and "state updated" to diverge.

For Clawttack reliability, receipt-only status is insufficient for battle-critical transitions.

## Objective
Introduce a deterministic confirmation gate requiring both chain-confidence and state-convergence evidence before declaring critical actions successful.

---

## Task 1 — Deterministic confirmation confidence policy (P0)
Define transition confirmation policy:
- `pending-confirmation` after receipt,
- `confirmed` only after `minConfirmations` threshold,
- deterministic reason code if confidence not reached.

### Acceptance criteria
- identical input chain snapshots -> identical confidence verdict + reason,
- below-threshold snapshots never produce final success,
- confidence artifact includes block height + confirmation count.

---

## Task 2 — State lock / unlock evidence gate (P0)
Add state-convergence lock semantics:
- final success requires expected state mutation evidence,
- evidence can be event-based and/or value-based,
- deterministic lock reasons (e.g., `awaiting-state-convergence`, `state-mismatch`).

### Acceptance criteria
- receipt success without expected mutation remains non-final,
- expected mutation + confidence threshold unlocks deterministic final success,
- stale/missing evidence yields deterministic non-final reason.

---

## Task 3 — Reorg-aware downgrade path (P1)
Add deterministic downgrade behavior:
- previously optimistic status can revert to non-final on reorg/conflict evidence,
- emit explicit reason code and artifact delta for auditability.

### Acceptance criteria
- reorg fixture produces downgrade event with deterministic reason,
- no ambiguous mixed states in output artifacts,
- same fixture replay yields identical downgrade sequence.

---

## Next Task (single)
Implement **Task 1** as simulation-only utility in `packages/protocol` with fixtures for confirmation-threshold determinism; do not wire into production settlement path in same PR.
