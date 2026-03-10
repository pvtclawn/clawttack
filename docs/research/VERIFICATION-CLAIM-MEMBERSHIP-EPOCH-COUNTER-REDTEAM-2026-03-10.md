# Verification-Claim Membership-Epoch Counter Gate — Red-Team Report (2026-03-10)

## Scope
Review target:
- `docs/model/082-VERIFICATION-CLAIM-MEMBERSHIP-EPOCH-COUNTER-GATE-PLAN-2026-03-10.md`

Goal: identify how a monotonic counter gate can be bypassed or gamed while still appearing policy-compliant.

## Findings

### 1) Replay-window laundering via selective lag
**Vector:** attacker replays previously accepted evidence just inside allowed tolerance windows while withholding fresher counter updates.

**Failure mode:** verifier accepts stale-but-formally-valid counters, creating fake continuity under operational lag.

**Mitigation:** bind counter freshness to explicit observation window and reject stale observations with deterministic reason (`membership-epoch-counter-stale-window`).

---

### 2) Counter-reset spoofing after authority-set churn
**Vector:** actor claims a reset baseline (`previous=0` or low watermark) by exploiting authority-set rollover ambiguity.

**Failure mode:** old sequence is silently restarted, allowing replay of historical evidence under a “new baseline.”

**Mitigation:** persist monotonic floor keyed by `claimId+epochId+authoritySetId` and reject regressions with deterministic reason (`membership-epoch-counter-reset-detected`).

---

### 3) Gap-policy gaming through burst-splitting
**Vector:** attacker splits high jumps across micro-bursts that each stay just below max-gap threshold.

**Failure mode:** cumulative jump is large but per-step checks never trigger, bypassing intended anti-skip control.

**Mitigation:** add rolling cumulative-gap budget over a bounded window; fail with deterministic reason (`membership-epoch-counter-cumulative-gap`).

---

### 4) Cross-scope counter collision
**Vector:** reuse counter values across nearby scopes with weak scope canonicalization (case/alias mismatch in authority-set identifiers).

**Failure mode:** verifier associates progress from one scope to another, masking replay or reset conditions.

**Mitigation:** canonicalize scope identity before comparison and include scope hash in artifact/precondition checks; fail on mismatch (`membership-epoch-counter-scope-mismatch`).

---

### 5) Parallel-branch acceptance race
**Vector:** concurrent evaluators accept competing candidate counters derived from slightly different state snapshots.

**Failure mode:** two divergent “next valid counters” are accepted, breaking single-chain monotonicity assumptions.

**Mitigation:** require compare-and-swap style acceptance semantics (single-writer or token-fenced reducer) and emit deterministic conflict reason (`membership-epoch-counter-concurrent-conflict`).

## Proposed hardening tasks
1. Add stale-window and monotonic-floor checks (replay-window + reset resistance).
2. Add rolling cumulative-gap budget and scope-canonicalization checks.
3. Add deterministic concurrent-conflict handling for parallel acceptance paths.

## Acceptance criteria for next lane
- Replay-window laundering fixture fails deterministic stale-window check.
- Reset spoof fixture fails deterministic floor/regression check.
- Burst-splitting fixture fails cumulative-gap budget check.
- Scope-collision fixture fails canonical-scope validation.
- Parallel acceptance race fixture fails deterministic conflict check.
