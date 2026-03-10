# 077 — Verification-Claim Failure-Model Hardening Roadmap (2026-03-10)

## Context
Derived from red-team findings in:
- `docs/research/VERIFICATION-CLAIM-FAILURE-MODEL-REDTEAM-2026-03-10.md`

Goal: prevent failure-class downscoping, evidence-strength spoofing, and byzantine-claim laundering from producing false robustness claims.

## Task 1 — Failure-Class Binding + Downscope Detection
Lock claim failure class and reject silent reclassification to weaker models.

### Scope
- Bind each claim to immutable declared failure class (`crash-stop`/`omission`/`crash-recovery`/`byzantine`).
- Detect and fail weaker-class reinterpretation attempts.
- Preserve deterministic trace of class-binding decisions.

### Acceptance criteria
1. Downscoping fixture fails with `failure-model-downscope-detected`.
2. Correctly bound class fixture passes this gate deterministically.
3. Identical input tuples yield deterministic verdict + artifact hash.

---

## Task 2 — Assurance-Tier Evidence Strength + Byzantine Proof Floor
Require evidence strength to match declared failure-class risk.

### Scope
- Enforce evidence-strength tiers mapped to failure classes.
- Require explicit adversarial-proof minimum for byzantine-class claims.
- Reject mislabeled low-assurance evidence for high-assurance claims.

### Acceptance criteria
1. Evidence-strength spoof fixture fails with `failure-model-evidence-strength-invalid`.
2. Byzantine laundering fixture fails with `failure-model-byzantine-proof-missing`.
3. Class-appropriate strength evidence fixture passes deterministically.

---

## Task 3 — Cross-Model Conflict + Recovery-Coverage Completeness
Disallow contradictory mixed-model bundles and incomplete recovery guarantees.

### Scope
- Detect incompatible failure-model evidence combinations in one claim bundle.
- Enforce crash-recovery coverage for state-loss/replay integrity dimensions.
- Deterministic fail when conflict/coverage gaps exist.

### Acceptance criteria
1. Mixed-model contradiction fixture fails with `failure-model-coverage-conflict`.
2. Recovery blind-spot fixture fails with `failure-model-recovery-coverage-incomplete`.
3. Conflict-free, recovery-complete fixture passes deterministically.

## Next Task (single)
Lane B: implement Task 1 in simulation/tooling scope (failure-class binding + downscope detector + fixtures), no publish-path wiring in same change.
