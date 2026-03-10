# 049 — Verification Claim Completeness Hardening Roadmap (2026-03-10)

## Context
Derived from red-team findings in:
- `docs/research/VERIFICATION-CLAIM-COMPLETENESS-REDTEAM-2026-03-10.md`

Goal: prevent "technically compliant but misleading" reliability/status claims by hardening completeness-gate semantics and claim/evidence consistency.

## Task 1 — Semantic Caveat Quality Gate (not token-only)
Implement deterministic caveat-slot validator for claim text.

### Scope
- Required slots for non-pass-through claims:
  1. **scope-bound** (what is and is not covered),
  2. **known-open-risk** (explicit unresolved issue),
  3. **non-proven statement** (what remains unverified: integration/runtime).
- Reject caveat-token stuffing without slot fulfillment.

### Acceptance criteria
1. Fixture with caveat keywords but missing one required slot fails deterministically.
2. Fixture with all slots present passes caveat-quality check.
3. Deterministic reason emitted: `report-caveat-quality-insufficient`.

---

## Task 2 — Claim↔Evidence Scope Relevance Matrix
Bind claim class to allowed/required evidence classes.

### Scope
- `simulation-verified` -> simulation artifacts only.
- `integration-verified` -> requires integration-path artifact.
- `runtime-verified` -> requires live runtime signal.
- Reject adjacency citations that are real but non-causal.

### Acceptance criteria
1. Fixture with valid-but-wrong-scope evidence fails with deterministic mismatch reason.
2. Fixture with required scope-aligned evidence passes.
3. Deterministic reason emitted: `report-evidence-scope-mismatch`.

---

## Task 3 — Class/Text Consistency + Caveat Proximity Guard
Prevent wording-level implication inflation and caveat burying.

### Scope
- Class-aware implication lexicon (e.g., ban/flag "resolved", "stable", "production-ready" in low-evidence classes).
- Caveat proximity rule: required caveat must appear within configured sentence/paragraph window of primary claim.
- Detect class metadata vs headline implication mismatch.

### Acceptance criteria
1. Fixture where class is simulation but headline implies runtime certainty fails.
2. Fixture with caveat buried outside proximity window fails.
3. Deterministic reasons emitted: `claim-class-text-mismatch` and/or `caveat-proximity-fail`.

## Next Task (single)
Lane B: implement Task 1 in simulation/tooling scope (semantic caveat-slot validator + fixtures), no publish-path wiring in the same change.
