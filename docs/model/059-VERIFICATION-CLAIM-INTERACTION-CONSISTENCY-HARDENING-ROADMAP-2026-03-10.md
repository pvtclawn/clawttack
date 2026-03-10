# 059 — Verification-Claim Interaction-Consistency Hardening Roadmap (2026-03-10)

## Context
Derived from red-team findings in:
- `docs/research/VERIFICATION-CLAIM-INTERACTION-CONSISTENCY-REDTEAM-2026-03-10.md`

Goal: prevent aggregate claim passes that hide cross-module contradictions, omissions, or severity laundering.

## Task 1 — Prerequisite Conflict Lock + Completeness Hash
Enforce non-compensable prerequisite failures and required-module completeness.

### Scope
- Define required module set for aggregate verdict construction.
- Hard-fail aggregate pass if any prerequisite module emits fail verdict.
- Bind module bundle with deterministic completeness hash.

### Acceptance criteria
1. Prerequisite-fail + aggregate-pass fixture fails with `interaction-prereq-conflict`.
2. Missing-module fixture fails with `interaction-evidence-incomplete`.
3. Complete prerequisite-clean bundle passes this gate deterministically.

---

## Task 2 — Deterministic Reason-Severity Precedence Lattice
Prevent reason-downgrade manipulation in aggregate output.

### Scope
- Define canonical severity ordering across interaction reasons.
- Enforce deterministic worst-severity winner when multiple reasons apply.
- Reject aggregate outputs that select lower-severity reason over higher-severity eligible reason.

### Acceptance criteria
1. Reason-downgrade fixture fails with `interaction-reason-precedence-violation`.
2. Multi-reason fixture always resolves to same highest-severity reason.
3. Identical input tuple returns deterministic verdict + reason + artifact hash.

---

## Task 3 — Version-Lock + Canonical Reason Registry Validation
Reject cross-version stitching and alias-level semantic drift.

### Scope
- Require uniform schema/config version across module verdict bundle.
- Validate reason labels against canonical reason registry.
- Hard-fail unknown/aliased reason labels outside registry.

### Acceptance criteria
1. Cross-version bundle fixture fails with `interaction-version-mismatch`.
2. Unknown-alias reason fixture fails with `interaction-reason-alias-invalid`.
3. Version-aligned canonical bundle passes deterministically.

## Next Task (single)
Lane B: implement Task 1 in simulation/tooling scope (prerequisite conflict lock + completeness hash evaluator + fixtures), no publish-path wiring in same change.
