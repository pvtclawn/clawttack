# Misuse-Resistant Nonce Mode — Red-Team Review (2026-03-10)

## Scope
Red-team review of:
- `docs/model/046-MISUSE-RESISTANT-NONCE-MODE-PLAN-2026-03-10.md`

Objective challenged: deterministic safety-first nonce mode under turbulence with reservation semantics and serial barriers.

## Critical weaknesses

### 1) Reservation leakage / zombie ownership
**Failure mode:** runner crash leaves reservations active without valid owner heartbeat.

**Risk:** submit deadlock or hidden double-ownership ambiguity.

**Mitigation:**
- reservation TTL + fencing-token ownership checks,
- deterministic cleanup reason (`reservation-expired-cleanup`),
- stale-owner submit hard-fail.

---

### 2) Mode-thrashing under noisy turbulence
**Failure mode:** repeated borderline signals force rapid enable/disable oscillation.

**Risk:** throughput collapse and unstable operator semantics.

**Mitigation:**
- transition hysteresis with hold-down windows,
- minimum dwell time in safety mode,
- deterministic transition reason artifacts (`safety-mode-thrash-protected`).

---

### 3) False-calm re-entry hazard
**Failure mode:** safety mode exits after short quiet interval while unresolved reservation conflicts persist.

**Risk:** immediate reintroduction of nonce collisions.

**Mitigation:**
- re-entry requires zero unresolved conflicts + conflict-debt below threshold,
- deterministic reject reason on premature exit (`false-calm-reentry-denied`).

---

### 4) Reservation token replay/spoofing
**Failure mode:** reservation artifact not strongly bound to scope/owner/token/intent.

**Risk:** forged reservation claims bypass safety guarantees.

**Mitigation:**
- cryptographic reservation binding hash over canonical scope + token + intent + epoch,
- deterministic reject (`reservation-binding-invalid`) on mismatch.

---

### 5) Serial-barrier liveness griefing
**Failure mode:** adversarial perturbations keep runner in serial safety mode indefinitely.

**Risk:** permanent underutilization despite recoverable conditions.

**Mitigation:**
- bounded degraded serial mode with explicit recovery criteria,
- deterministic escalation status (`serial-safety-persistent`) + operator hint,
- capped backoff progression.

## Recommended hardening direction
Before claiming misuse-resistant throughput safety, require fixture-backed guarantees for:
1. reservation lifecycle integrity,
2. anti-thrashing hysteresis correctness,
3. false-calm rejection,
4. reservation binding validity,
5. bounded serial recovery behavior.

No end-to-end claim until these invariants hold under turbulence fixtures.
