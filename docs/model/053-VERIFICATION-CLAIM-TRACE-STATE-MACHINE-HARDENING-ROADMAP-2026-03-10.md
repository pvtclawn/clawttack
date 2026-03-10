# 053 — Verification-Claim Trace State-Machine Hardening Roadmap (2026-03-10)

## Context
Derived from red-team findings in:
- `docs/research/VERIFICATION-CLAIM-TRACE-STATE-MACHINE-REDTEAM-2026-03-10.md`

Goal: prevent trace-level bypasses where a decision path looks structurally valid but is forged, replayed, ambiguous, or cross-claim spliced.

## Task 1 — Step Provenance + Replay-Resistance Binding
Require each trace step to carry deterministic claim/input provenance and freshness-safe binding.

### Scope
- Bind every step to immutable tuple: `claimId`, `inputRoot`, `phase`, `stepIndex`.
- Enforce freshness policy for trace envelope to block historical replay.
- Reject steps missing or mismatching provenance fields.

### Acceptance criteria
1. Forged-step fixture fails with deterministic reason `step-provenance-invalid`.
2. Historical trace replay fixture fails with `trace-replay-detected`.
3. Valid fresh trace with correct provenance passes this gate.

---

## Task 2 — Phase/Index Uniqueness + Completeness Enforcement
Disallow ambiguity and required-phase bypasses.

### Scope
- Enforce uniqueness for `(claimId, stepIndex)` and `(claimId, phase)`.
- Require full phase set: `ingest`, `caveat`, `triangulation`, `aggregate`.
- Hard-fail if aggregate appears without all prerequisite phases.

### Acceptance criteria
1. Missing-phase fixture fails with `claim-gate-trace-missing-step`.
2. Duplicate-index/duplicate-phase fixture fails with `trace-ambiguity-detected`.
3. Complete unique-phase trace passes.

---

## Task 3 — Domain-Separated Hash-Chain Contract
Prevent cross-claim grafting and hash-chain splice attacks.

### Scope
- Compute each step hash from domain-separated preimage:
  - `claimId|phase|stepIndex|inputRoot|prevHash|stepReason|outputRoot`.
- Aggregate step must reference exact predecessor chain head.
- Reject chain inconsistencies deterministically.

### Acceptance criteria
1. Cross-claim graft fixture fails with `trace-domain-separation-fail`.
2. Broken predecessor link fixture fails with `claim-gate-trace-hash-chain-broken`.
3. Identical valid trace input returns deterministic verdict + artifact hash.

## Next Task (single)
Lane B: implement Task 1 in simulation/tooling scope (provenance+replay-resistance evaluator + fixtures), no publish-path wiring in the same change.
