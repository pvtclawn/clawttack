# Single-Writer Runner Lock — Red-Team Review (2026-03-10)

## Scope
Red-team review of:
- `docs/model/042-SINGLE-WRITER-RUNNER-LOCK-PLAN-2026-03-10.md`

Objective challenged: deterministic single-writer nonce ownership via lock + monotonic fencing token.

## Critical weaknesses

### 1) Stale-token writer resurrection
**Failure mode:** old process resumes after restart and submits with obsolete lock context.

**Risk:** nonce split-brain returns despite lock design.

**Mitigation:**
- mandatory token check at every submit boundary,
- deterministic reject reason (`stale-fencing-token`),
- immediate stale-runner self-termination.

---

### 2) Token rollback / lock-file tampering
**Failure mode:** lock state rollback or manual overwrite reintroduces lower token values.

**Risk:** monotonicity guarantee breaks, allowing replay ownership claims.

**Mitigation:**
- token floor persistence + monotonic assertion,
- lock-state checksum/version binding,
- deterministic hard-fail on rollback detection (`token-regression-detected`).

---

### 3) Lease-expiry race split-brain
**Failure mode:** two runners observe expiry and both acquire near-simultaneously.

**Risk:** dual-writer submit window under contention.

**Mitigation:**
- CAS acquisition semantics,
- random backoff/jitter on contention,
- winner-only token promotion; loser must re-read and abort.

---

### 4) Partial-write false recovery
**Failure mode:** crash during lock write leaves malformed/partial lock artifact.

**Risk:** ambiguous owner/token interpretation and unsafe recovery.

**Mitigation:**
- atomic write+rename protocol with fsync,
- strict schema validation and deterministic reject (`lock-state-corrupt`),
- safe recovery path issuing fresh higher token only.

---

### 5) Lock scope misconfiguration
**Failure mode:** scope key too coarse (unrelated jobs blocked) or too narrow (related jobs bypass each other).

**Risk:** liveness degradation or hidden nonce collisions.

**Mitigation:**
- canonical scope key: `chainId:arena:wallet`,
- explicit scope-id in lock artifact,
- deterministic mismatch reason (`lock-scope-mismatch`).

## Recommended hardening direction
Before runtime-wide adoption, ship fixture-backed P0 checks for:
1. stale-token rejection,
2. lease-race single-winner determinism,
3. rollback/corruption detection,
4. scope-canonicalization invariants.

No claim of nonce-safe autonomy without these deterministic proofs.
