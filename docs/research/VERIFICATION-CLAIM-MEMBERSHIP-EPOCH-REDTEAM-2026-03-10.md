# Verification-Claim Membership-Epoch Compatibility Gate — Red-Team Report (2026-03-10)

## Scope
Review target:
- `docs/model/080-VERIFICATION-CLAIM-MEMBERSHIP-EPOCH-COMPATIBILITY-GATE-PLAN-2026-03-10.md`

Goal: identify how stale or inconsistent membership views can still be used to satisfy epoch compatibility checks.

## Findings

### 1) Stale-epoch laundering
**Vector:** old epoch evidence replayed after membership set changed.

**Failure mode:** compatibility check accepts superseded membership state.

**Mitigation:** freshness + current-epoch anchor checks; fail with `membership-epoch-stale`.

---

### 2) Split-view quorum spoofing
**Vector:** quorum proof assembled from multiple epoch views.

**Failure mode:** non-overlapping authority sets appear as one valid quorum.

**Mitigation:** single-epoch quorum consistency invariant; fail with `membership-epoch-split-view`.

---

### 3) Join/leave transition abuse
**Vector:** claim finalized during unstable transition propagation window.

**Failure mode:** premature pass before membership convergence.

**Mitigation:** transition stabilization dwell rule; fail with `membership-epoch-transition-unstable`.

---

### 4) Epoch ID aliasing
**Vector:** ambiguous/aliased epoch ids map to conflicting membership snapshots.

**Failure mode:** verifier binds to unintended epoch state.

**Mitigation:** canonical epoch id hash validation; fail with `membership-epoch-id-invalid`.

---

### 5) Partial epoch metadata omission
**Vector:** missing epoch version/transition context in evidence bundle.

**Failure mode:** incomplete epoch semantics accepted as complete.

**Mitigation:** required epoch metadata completeness contract; fail with `membership-epoch-evidence-incomplete`.

## Proposed hardening tasks
1. Add stale-epoch and split-view quorum detection checks.
2. Add transition-stabilization and canonical epoch-id validation.
3. Add full epoch metadata completeness enforcement.

## Acceptance criteria for next lane
- Stale-epoch replay fixture fails deterministically.
- Split-view quorum fixture fails deterministic same-epoch checks.
- Transition-unstable fixture fails deterministic dwell checks.
- Epoch-id aliasing fixture fails canonical-id validation.
- Partial epoch metadata fixture fails completeness checks.
