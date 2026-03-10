# 067 — Verification-Claim Local-Authority Coordination Hardening Roadmap (2026-03-10)

## Context
Derived from red-team findings in:
- `docs/research/VERIFICATION-CLAIM-LOCAL-AUTHORITY-COORDINATION-REDTEAM-2026-03-10.md`

Goal: prevent synthetic local quorum, confidence skew, and class-coverage omissions from producing false global coordination passes.

## Task 1 — Authority Authenticity + Uniqueness Lock
Require every local authority decision to be identity-authenticated and unique in bundle scope.

### Scope
- Validate authority identity authenticity/provenance per local verdict.
- Enforce unique authority IDs (no duplicate-padding).
- Hard-fail spoofed or duplicate authority bundles.

### Acceptance criteria
1. Forged authority fixture fails with `authority-identity-invalid`.
2. Duplicate authority-padding fixture fails with `authority-quorum-quality-insufficient`.
3. Authentic unique authority bundle passes this gate deterministically.

---

## Task 2 — Quality-Weighted Quorum + Required Class Coverage
Prevent count-only quorum passes with weak or class-incomplete authority sets.

### Scope
- Require minimum quality-weighted quorum score (not cardinality alone).
- Enforce required authority-class coverage for global decisions.
- Reject class omission masked by surplus same-class authorities.

### Acceptance criteria
1. Low-quality quorum fixture fails with `authority-quorum-quality-insufficient`.
2. Missing authority-class fixture fails with `authority-class-coverage-incomplete`.
3. Quality-sufficient, class-complete fixture passes deterministically.

---

## Task 3 — Deterministic Conflict Precedence + Confidence Integrity
Disallow pass-favoring conflict resolution and confidence-manipulation skew.

### Scope
- Non-compensable conflict handling for incompatible local outcomes.
- Confidence provenance and bounded calibration checks.
- Deterministic precedence lattice for multi-reason conflict outcomes.

### Acceptance criteria
1. Conflict-precedence manipulation fixture fails with `authority-coordination-conflict`.
2. Confidence-inflation fixture fails with `authority-confidence-integrity-fail`.
3. Conflict-free, confidence-valid bundle passes deterministically.

## Next Task (single)
Lane B: implement Task 1 in simulation/tooling scope (authority authenticity + uniqueness evaluator + fixtures), no publish-path wiring in same change.
