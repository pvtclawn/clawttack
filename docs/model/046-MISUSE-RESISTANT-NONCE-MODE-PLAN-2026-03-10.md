# 046 — Misuse-Resistant Nonce Mode Plan (2026-03-10)

## Context
Reading (`Serious Cryptography`) reinforces a practical security principle:
- preventing nonce misuse often requires accepting performance overhead.

Current Clawttack runner issues under turbulence (nonce collisions/replacements) suggest we need an explicit safety-first execution mode.

## Objective
Add a deterministic **misuse-resistant nonce mode** for autonomous runners that prioritizes nonce integrity over peak throughput under turbulence.

---

## Task 1 — Nonce reservation ledger with exclusive claim semantics (P0)
Introduce nonce-slot reservation before tx build/submit.

### Acceptance criteria
- every submission intent requires an exclusive reservation token,
- no two active intents can hold same reservation without deterministic replacement linkage,
- unreserved submit attempts fail with deterministic reason (`nonce-not-reserved`).

---

## Task 2 — Turbulence-triggered mode switch policy (P0)
Add deterministic switch into misuse-resistant mode when turbulence signals cross threshold.

Signals (example):
- repeated `nonce too low`,
- repeated `replacement underpriced`,
- active conflict count in intent ledger.

### Acceptance criteria
- threshold crossing deterministically enters safety mode,
- safety mode enforces serial reservation/submit barrier,
- deterministic reason artifact emitted on mode transition (`nonce-safety-mode-enabled`).

---

## Task 3 — Bounded recovery and throughput re-entry (P1)
Return from safety mode only after explicit calm-window criteria.

### Acceptance criteria
- calm-window criteria deterministic and artifacted,
- no re-entry to high-throughput mode while unresolved reservation conflicts exist,
- deterministic recovery reason emitted (`nonce-safety-mode-disabled`).

---

## Next Task (single)
Implement **Task 1** in simulation/tooling scope as reservation-check utility + fixtures; keep production submit-path integration isolated to one controlled flow.
