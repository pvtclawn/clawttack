# Nonce Pipeline Integration — Red-Team Review (2026-03-10)

## Scope
Red-team review of:
- `docs/model/044-NONCE-PIPELINE-INTEGRATION-PLAN-2026-03-10.md`

Objective challenged: deterministic nonce sequencing via intent ledger + replacement policy + sequencing barriers.

## Critical weaknesses

### 1) Ledger rollback and nonce-floor regression
**Failure mode:** intent ledger is rewritten/truncated after restart, re-exposing previously consumed nonce space.

**Risk:** duplicate nonce assignment and hidden replay of stale intents.

**Mitigation:**
- monotonic nonce-floor persistence,
- append-only intent journal or tamper-evident snapshots,
- deterministic reject reason (`nonce-floor-regression`).

---

### 2) Broken replacement lineage
**Failure mode:** replacement tx recorded without strict parent chain, or parent-child nonce mismatch.

**Risk:** orphan pending intents and contradictory final-status reporting.

**Mitigation:**
- enforce same-nonce parent-child invariant,
- require replacement ancestry links for every override,
- deterministic reject (`replacement-lineage-invalid`) on gap/cycle/mismatch.

---

### 3) Scope alias bypass
**Failure mode:** logically identical scope represented in multiple forms (case/format/alias), creating parallel nonce owners.

**Risk:** split-brain owner state despite locking.

**Mitigation:**
- canonical scope normalization (`chainId:arenaChecksum:walletChecksum`),
- deterministic mismatch reject (`scope-canonicalization-failed`),
- fixture proving one canonical key per logical scope.

---

### 4) Serial-fallback liveness trap
**Failure mode:** turbulence repeatedly pushes runner into serial fallback with no stable recovery path.

**Risk:** persistent throughput collapse under mild adversarial conditions.

**Mitigation:**
- bounded fallback duration with explicit recovery thresholds,
- progressive backoff ceilings + reset conditions,
- deterministic status (`serial-fallback-persistent`) for operator visibility.

---

### 5) Stale confirmation observer acceptance
**Failure mode:** stale RPC/indexer view marks intent confirmed before canonical chain ordering converges.

**Risk:** out-of-order or false terminal success states.

**Mitigation:**
- confirmation quorum over freshness-bounded sources,
- ordered block/tx-index checks before terminal transition,
- deterministic reject (`stale-confirmation-view`).

## Recommended hardening direction
Before production rollout, add fixture-backed P0 checks for:
1. nonce-floor monotonicity after restart,
2. replacement-lineage validity invariants,
3. scope canonicalization uniqueness,
4. stale-confirmation rejection.

No throughput claims should be made without these invariants passing under turbulence fixtures.
