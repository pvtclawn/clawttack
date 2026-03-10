# 071 — Verification-Claim System-Model Hardening Roadmap (2026-03-10)

## Context
Derived from red-team findings in:
- `docs/research/VERIFICATION-CLAIM-SYSTEM-MODEL-REDTEAM-2026-03-10.md`

Goal: prevent model-profile spoofing, matrix drift, and cross-model overclaims from producing false correctness assertions.

## Task 1 — Profile Authenticity + Assumption Completeness Lock
Require authentic model profiles and complete assumption fields for every claim/evidence bundle.

### Scope
- Validate cryptographic/profile provenance binding.
- Enforce required model-assumption fields (timing, failure semantics, message guarantees).
- Reject under-specified or forged profile bundles.

### Acceptance criteria
1. Profile spoof fixture fails with `system-model-profile-invalid`.
2. Partial-assumption omission fixture fails with `system-model-assumptions-incomplete`.
3. Authentic, fully specified profile bundle passes deterministically.

---

## Task 2 — Compatibility Matrix Version/Hash Immutability Gate
Prevent non-reproducible verdict drift across matrix revisions.

### Scope
- Bind each verdict to explicit compatibility matrix version + hash.
- Reject evidence bundles evaluated against mismatched matrix versions/hashes.
- Require deterministic version-lock metadata in artifact output.

### Acceptance criteria
1. Matrix drift fixture fails with `system-model-matrix-version-mismatch`.
2. Version/hash-aligned fixture passes deterministically.
3. Identical input tuples produce identical verdict + artifact hash.

---

## Task 3 — Overclaim + No-Silent-Fallback Protection
Block model-agnostic claims from model-bound evidence and disallow hidden fallback downgrades.

### Scope
- Enforce model-scope claim-text consistency checks.
- Disallow silent fallback to permissive model on mismatch.
- Require explicit fallback reason paths where allowed by policy.

### Acceptance criteria
1. Cross-model overclaim fixture fails with `system-model-overclaim`.
2. Silent fallback fixture fails with `system-model-fallback-disallowed`.
3. Policy-compliant model-scope claim passes deterministically.

## Next Task (single)
Lane B: implement Task 1 in simulation/tooling scope (profile authenticity + assumption completeness evaluator + fixtures), no publish-path wiring in same change.
