# 045 — Nonce Pipeline Hardening Roadmap (2026-03-10)

## Context
Following red-team findings in:
- `docs/research/NONCE-PIPELINE-INTEGRATION-REDTEAM-2026-03-10.md`

The integration plan (`044`) needs constrained hardening before claiming nonce-safe autonomous throughput.

## Goal
Guarantee deterministic nonce ownership and transition correctness under turbulence (restarts, replacements, stale observers, and scope aliasing).

---

## Task 1 — Monotonic nonce-floor + append-only intent integrity (P0)
Harden intent ledger persistence so nonce ownership cannot regress after restart/corruption.

### Acceptance criteria
- restart fixtures cannot reduce persisted nonce floor,
- append-only journal/snapshot checks detect truncation/rollback with deterministic `nonce-floor-regression`,
- stale token holders cannot append or mutate ledger state.

---

## Task 2 — Replacement-lineage and canonical scope invariants (P0)
Enforce unambiguous same-nonce replacement ancestry and one canonical scope identity.

### Acceptance criteria
- every replacement links to valid parent with identical nonce; invalid chain yields deterministic `replacement-lineage-invalid`,
- canonical scope normalization (`chainId:arenaChecksum:walletChecksum`) produces one deterministic scope key,
- scope alias attempts fail with deterministic `scope-canonicalization-failed`.

---

## Task 3 — Fresh-confirmation gate + bounded serial-fallback recovery (P1)
Prevent stale observer acceptance and avoid permanent serial-fallback starvation.

### Acceptance criteria
- stale confirmation view rejected with deterministic `stale-confirmation-view`,
- confirmation transition requires freshness-bounded ordered checks,
- persistent turbulence triggers deterministic serial fallback with explicit recovery criteria and bounded retry/backoff policy.

---

## Next Task (single)
Implement **Task 1** in simulation/tooling scope with fixture-backed nonce-floor monotonicity + rollback-detection checks; keep production path changes isolated to one submit flow.
