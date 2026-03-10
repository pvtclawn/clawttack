# 073 — Verification-Claim Model-Intent Hardening Roadmap (2026-03-10)

## Context
Derived from red-team findings in:
- `docs/research/VERIFICATION-CLAIM-MODEL-INTENT-REDTEAM-2026-03-10.md`

Goal: prevent intent-label spoofing and theoretical→practical overclaim laundering from producing false confidence passes.

## Task 1 — Intent Provenance + Matrix Lock Gate
Require authentic intent labels and immutable compatibility policy mapping.

### Scope
- Validate intent label provenance for claim/evidence bundles.
- Enforce compatibility matrix version/hash lock.
- Reject spoofed labels and matrix drift conditions.

### Acceptance criteria
1. Intent-label spoof fixture fails with `model-intent-label-invalid`.
2. Matrix drift fixture fails with `model-intent-matrix-drift`.
3. Authentic labels with locked matrix mapping pass deterministically.

---

## Task 2 — Practical-Coverage Floor + Hybrid Decomposition
Prevent practical claims from passing with theory-only or under-decomposed hybrid evidence.

### Scope
- Require minimum operational/practical evidence floor for `practical-operational` claims.
- Require `hybrid` claims to decompose into explicit required sub-intents.
- Reject hybrid wildcard bypass behavior.

### Acceptance criteria
1. Theoretical→practical laundering fixture fails with `model-intent-practical-coverage-insufficient`.
2. Hybrid ambiguity fixture fails with `model-intent-hybrid-decomposition-fail`.
3. Practical/hybrid claims with required coverage pass deterministically.

---

## Task 3 — Critical Intent-Dimension Completeness Contract
Disallow aggregate passes when essential intent dimensions are missing.

### Scope
- Define critical intent dimensions required for each claim intent.
- Enforce completeness checks over critical dimensions, not just aggregate counts.
- Deterministic fail when critical intent coverage is absent.

### Acceptance criteria
1. Coverage-hole fixture fails with `model-intent-critical-coverage-missing`.
2. Complete critical-dimension coverage fixture passes deterministically.
3. Identical input tuples yield deterministic verdict + artifact hash.

## Next Task (single)
Lane B: implement Task 1 in simulation/tooling scope (intent provenance + matrix lock evaluator + fixtures), no publish-path wiring in same change.
