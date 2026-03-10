# 044 — Nonce Pipeline Integration Plan (2026-03-10)

## Context
Recent runtime failures show that lock/fencing alone does not fully stabilize autonomous submission.

Reading basis (`books_and_papers/004_building_ethereum_products_and_protocols.pdf`, ch.3 nonces):
- nonces enforce strict sequencing,
- nonce gaps stall mempool progression,
- async submission requires centralized nonce assignment and careful sequential confirmation.

## Objective
Integrate single-writer locking with a deterministic nonce pipeline so tx ordering/replacement behavior is explicit and reproducible.

---

## Task 1 — Canonical TxIntent ledger with nonce ownership (P0)
Add a local per-scope intent ledger (`chainId:arena:wallet`) that records:
- assigned nonce,
- intent id,
- lifecycle state (`built`, `submitted`, `pending`, `confirmed`, `replaced`, `failed`),
- owning fencing token.

### Acceptance criteria
- no two live intents share same nonce without deterministic replacement relationship,
- stale-token holders cannot append intents,
- ledger replays deterministically to same intent-state graph.

---

## Task 2 — Deterministic replacement policy (P0)
Define same-nonce override rules as first-class behavior:
- replacement reason taxonomy (`fee-bump`, `state-invalidated`, `manual-cancel`),
- bounded fee bump schedule,
- deterministic replacement chain linking old/new intent ids.

### Acceptance criteria
- replacements preserve nonce continuity and full ancestry,
- replacement attempts outside policy fail closed with deterministic reason,
- fixture shows no orphan pending-intent state after replacement success.

---

## Task 3 — Sequencing barrier + bounded parallelism (P1)
Enforce confirmation-aware sequencing:
- critical paths use `confirm-before-next` barrier,
- optional bounded pipeline width only when nonce-safe conditions hold,
- deterministic fallback to serial mode on turbulence.

### Acceptance criteria
- out-of-order async fixture cannot violate nonce/confirmation invariants,
- turbulence fixture triggers deterministic serial fallback,
- barrier state transitions are reproducible from artifacts.

---

## Next Task (single)
Implement **Task 1** as simulation/tooling module in runner scope with fixture-backed deterministic intent-lifecycle checks; keep production integration isolated to one path.
