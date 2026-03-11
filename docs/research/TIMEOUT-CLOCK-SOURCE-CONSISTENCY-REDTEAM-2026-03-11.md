# Timeout Clock-Source Consistency Gate — Red-Team Report (2026-03-11)

## Scope
Target plan:
- `docs/model/090-TIMEOUT-CLOCK-SOURCE-CONSISTENCY-GATE-PLAN-2026-03-11.md`

Goal: identify how clock-source consistency checks can be gamed to force false ordering confidence or suppress valid uncertainty.

## Findings

### 1) Monotonic-counter forgery inside compromised worker context
**Vector:** attacker forges locally monotonic timestamps/counters even while true event ordering is inconsistent.

**Failure mode:** gate emits `timeout-clock-source-pass` because synthetic monotonic stream looks valid.

**Mitigation:** bind monotonic progression to trusted runtime provenance (process epoch + signer/fingerprint) and reject unverifiable streams (`timeout-clock-source-provenance-invalid`).

---

### 2) Mixed-source ordering confusion (monotonic vs wall-clock cross-use)
**Vector:** evaluator accidentally compares monotonic deltas from one source with wall-clock timestamps from another in the same ordering decision.

**Failure mode:** false confidence in cross-source ordering; uncertainty should have been preserved.

**Mitigation:** enforce source-class segregation and fail mixed-order comparisons deterministically (`timeout-clock-source-mixed-ordering-invalid`).

---

### 3) Cross-node uncertainty laundering via pseudo-sync metadata
**Vector:** stale/forged synchronization metadata marks nodes as “synchronized,” bypassing uncertainty downgrade.

**Failure mode:** inter-node wall-clock comparisons incorrectly treated as ordered truth.

**Mitigation:** require freshness+authenticity checks on sync metadata and downgrade on stale/untrusted sync claims (`timeout-clock-source-sync-proof-invalid`).

---

### 4) Backward-time masking at boundary resets
**Vector:** hide backward wall-time jumps at window/epoch boundaries so regressions are interpreted as legitimate rollovers.

**Failure mode:** `backward-time` violations go undetected under reset transitions.

**Mitigation:** add rollover invariants with strict lower-bound continuity checks (`timeout-clock-source-rollover-regression`).

---

### 5) Uncertainty suppression by selective sample omission
**Vector:** drop uncertain cross-node samples and retain only seemingly ordered ones.

**Failure mode:** evaluator underestimates uncertainty and over-promotes pass outcomes.

**Mitigation:** require coverage completeness for expected source set; missing required observations triggers uncertainty (`timeout-clock-source-coverage-incomplete`).

## Proposed hardening tasks
1. Provenance-bound monotonic stream validation + anti-forgery checks.
2. Source-class segregation + mixed-ordering invalidation rules.
3. Sync-proof authenticity/freshness checks + uncertainty-by-default fallback.
4. Rollover-regression invariants + coverage completeness guard.

## Acceptance criteria for next lane
- Forged monotonic stream fixtures fail `timeout-clock-source-provenance-invalid`.
- Mixed-source ordering fixtures fail `timeout-clock-source-mixed-ordering-invalid`.
- Stale/forged sync-proof fixtures fail `timeout-clock-source-sync-proof-invalid`.
- Boundary regression fixtures fail `timeout-clock-source-rollover-regression`.
- Sample omission fixtures fail `timeout-clock-source-coverage-incomplete`.
