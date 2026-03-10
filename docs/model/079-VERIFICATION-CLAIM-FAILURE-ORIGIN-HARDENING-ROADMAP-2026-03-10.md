# 079 — Verification-Claim Failure-Origin Hardening Roadmap (2026-03-10)

## Context
Derived from red-team findings in:
- `docs/research/VERIFICATION-CLAIM-FAILURE-ORIGIN-REDTEAM-2026-03-10.md`

Goal: prevent origin-tag spoofing and mixed-origin overclaims from presenting incomplete resilience as full component+network coverage.

## Task 1 — Origin-Tag Authenticity + Mixed-Origin Dual-Coverage Gate
Require authentic origin tags and strict dual-origin evidence for mixed claims.

### Scope
- Validate authenticity/provenance of origin tags on evidence artifacts.
- Enforce strict dual-origin coverage for `mixed` claims.
- Fail single-origin evidence bundles pretending mixed coverage.

### Acceptance criteria
1. Origin-tag spoof fixture fails with `failure-origin-tag-invalid`.
2. Mixed-origin overclaim fixture fails with `failure-origin-mixed-coverage-insufficient`.
3. Authentic dual-origin evidence fixture passes deterministically.

---

## Task 2 — Origin Disclosure Completeness + Adverse-Origin Omission Detection
Prevent selective reporting of favorable origin evidence.

### Scope
- Build deterministic completeness hash across required origin disclosures.
- Detect omission of adverse or required origin classes.
- Fail when required origin disclosures are missing.

### Acceptance criteria
1. Selective-origin omission fixture fails with `failure-origin-evidence-incomplete`.
2. Complete origin disclosure fixture passes with deterministic completeness hash.
3. Identical input tuples produce deterministic verdict + artifact hash.

---

## Task 3 — Cross-Origin Interaction Coverage + Taxonomy Integrity
Ensure mixed-origin claims include interaction-risk coverage and no lossy downmapping.

### Scope
- Require explicit interaction-risk coverage for component+network combined failures.
- Enforce canonical origin taxonomy (no lossy sub-origin collapse).
- Fail contradictory or downmapped taxonomy bundles.

### Acceptance criteria
1. Interaction blind-spot fixture fails with `failure-origin-interaction-coverage-missing`.
2. Lossy-taxonomy fixture fails with `failure-origin-taxonomy-lossy`.
3. Interaction-complete taxonomy-consistent fixture passes deterministically.

## Next Task (single)
Lane B: implement Task 1 in simulation/tooling scope (origin-tag authenticity + mixed-coverage evaluator + fixtures), no publish-path wiring in same change.
