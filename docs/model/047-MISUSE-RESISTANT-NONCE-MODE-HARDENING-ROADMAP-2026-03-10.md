# 047 — Misuse-Resistant Nonce Mode Hardening Roadmap (2026-03-10)

## Context
From red-team findings in:
- `docs/research/MISUSE-RESISTANT-NONCE-MODE-REDTEAM-2026-03-10.md`

The baseline misuse-resistant mode plan (`046`) needs constrained hardening before claiming stable autonomous throughput under turbulence.

## Goal
Make safety-first nonce mode deterministic, abuse-resistant, and operationally recoverable without permanent throughput collapse.

---

## Task 1 — Reservation lifecycle integrity + stale-claim cleanup (P0)
Guarantee reservation ownership validity across crashes/restarts.

### Acceptance criteria
- reservation tokens are bound to owner token + scope + intent,
- expired/zombie reservations are deterministically cleaned (`reservation-expired-cleanup`),
- stale owners cannot submit with leaked reservations (`reservation-binding-invalid` / stale-owner reject).

---

## Task 2 — Anti-thrashing transition hysteresis (P0)
Prevent rapid enable/disable oscillation of safety mode under noisy turbulence.

### Acceptance criteria
- deterministic hold-down windows for mode transitions,
- minimum dwell-time in safety mode enforced,
- oscillation fixture triggers deterministic protection reason (`safety-mode-thrash-protected`).

---

## Task 3 — False-calm re-entry guard + bounded serial recovery (P1)
Allow re-entry to high-throughput mode only when conflict risk is truly cleared.

### Acceptance criteria
- re-entry requires zero unresolved reservations and low conflict debt,
- premature re-entry attempts fail deterministically (`false-calm-reentry-denied`),
- serial-safety persistence emits explicit degraded-state signal with bounded recovery/backoff policy.

---

## Next Task (single)
Implement **Task 1** in simulation/tooling scope (reservation verifier + lifecycle fixtures), with deterministic reason codes and no broad production submit-path refactor in the same PR.
