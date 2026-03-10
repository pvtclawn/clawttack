# State-Convergence Confirmation Gate — Red-Team Review (2026-03-10)

## Scope
Red-team review of:
- `docs/model/040-STATE-CONVERGENCE-CONFIRMATION-GATE-PLAN-2026-03-10.md`

Objective challenged: deterministic confirmation confidence + state-convergence lock for battle-critical transitions.

## Critical weaknesses

### 1) Reorg bounce ambiguity
**Failure mode:** optimistic confirmation can be emitted before confidence is truly robust, then reversed after a short reorg.

**Risk:** contradictory external evidence artifacts (`confirmed` then `downgraded`) without clear deterministic precedence.

**Mitigation:**
- no terminal success below confidence threshold,
- deterministic downgrade reason priority (`reorg-detected` > `state-mismatch` > `indexer-stale`),
- immutable artifact sequence IDs for state transitions.

---

### 2) Stale indexer convergence false-positive
**Failure mode:** delayed indexer/websocket data appears as convergence while latest chain state has diverged.

**Risk:** false unlock of confirmation gate; reliability overclaim.

**Mitigation:**
- include evidence freshness bounds (`observedBlock >= receiptBlock`, max staleness),
- reject stale convergence evidence with deterministic `evidence-stale` reason,
- prefer chain reads for final unlock confirmation when available.

---

### 3) Single-channel signal spoofing
**Failure mode:** unlock logic trusts either event OR value change independently.

**Risk:** partial/phantom signal paths can satisfy unlock conditions.

**Mitigation:**
- require dual-channel convergence (`event AND expected value mutation`) for terminal unlock,
- deterministic `partial-convergence` reason when only one channel is present.

---

### 4) Nondeterministic downgrade sequence under retries
**Failure mode:** asynchronous polling timing differences produce inconsistent downgrade/restore paths.

**Risk:** replayed runs disagree; audit trail becomes non-reproducible.

**Mitigation:**
- deterministic precedence table for transition evaluation,
- idempotent transition reducer over ordered evidence snapshots,
- fixture tests asserting sequence determinism under reordered evidence arrival.

---

### 5) Liveness degradation from strict locking
**Failure mode:** persistent infra degradation can keep valid transactions indefinitely pending.

**Risk:** operator fatigue + user confusion; potential griefing via infra-induced lock persistence.

**Mitigation:**
- bounded degraded-pending state with explicit reason (`awaiting-convergence-degraded`),
- escalation policy after threshold retries/age,
- ensure degraded path never mislabels as success.

## Recommended hardening direction
Before production promotion, create a constrained roadmap with 3 P0 checks:
1. deterministic reorg downgrade policy,
2. freshness-bound dual-channel convergence enforcement,
3. liveness-safe degraded pending mode with deterministic reasoning.

No success-state overclaim until all three have fixture-backed verification artifacts.
