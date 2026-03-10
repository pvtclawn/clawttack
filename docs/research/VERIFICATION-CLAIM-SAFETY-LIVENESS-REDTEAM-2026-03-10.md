# Verification-Claim Safety+Liveness Correctness Gate — Red-Team Report (2026-03-10)

## Scope
Review target:
- `docs/model/054-VERIFICATION-CLAIM-CORRECTNESS-SAFETY-LIVENESS-PLAN-2026-03-10.md`

Goal: identify how a claim workflow could satisfy naive safety/liveness checks while still overclaiming, omitting risk, or converging to invalid terminal states.

## Findings

### 1) False-terminal spoofing
**Vector:** fabricate terminal status without validated prerequisite phases.

**Failure mode:** liveness appears successful (`terminal reached`) while safety path was never executed.

**Mitigation:** terminal admissibility rule requiring validated prerequisite phase set; fail with `terminal-prereq-missing`.

---

### 2) Timer gaming at boundary conditions
**Vector:** exploit deadline-edge jitter/clock skew to trigger deterministic timeout outcomes favorable to attacker.

**Failure mode:** liveness timeout behavior becomes gameable policy path.

**Mitigation:** monotonic timer source + anti-oscillation hysteresis window; fail with `timer-boundary-gaming-detected`.

---

### 3) Partial-trace omission
**Vector:** submit only terminal slice of workflow and omit intermediate violating transitions.

**Failure mode:** evaluator validates clean tail and misses unsafe path.

**Mitigation:** continuous trace coverage proof from ingest to terminal; fail with `trace-continuity-missing`.

---

### 4) Safety-reason laundering
**Vector:** remap critical safety signals into lower-severity warning buckets.

**Failure mode:** workflow incorrectly passes correctness despite critical violation evidence.

**Mitigation:** immutable safety taxonomy with non-downgradable critical reasons; fail with `safety-reason-integrity-fail`.

---

### 5) Converged but semantically wrong terminal state
**Vector:** force fast deterministic convergence into terminal status that contradicts state semantics.

**Failure mode:** liveness pass masks semantic invalidity.

**Mitigation:** terminal semantic validation gate; fail with `terminal-state-invalid`.

## Proposed hardening tasks
1. Add terminal admissibility + trace-continuity enforcement.
2. Add monotonic timer + anti-boundary-gaming constraints.
3. Add immutable critical safety taxonomy + terminal semantic validity checks.

## Acceptance criteria for next lane
- Synthetic terminal without prerequisites fails deterministically.
- Boundary-timer gaming fixture fails deterministically.
- Partial-trace submission fixture fails deterministically.
- Critical safety reason remap attempt fails deterministically.
- Fast convergence to semantically invalid terminal state fails deterministically.
