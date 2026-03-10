# 081 — Verification-Claim Membership-Epoch Hardening Roadmap (2026-03-10)

## Context
Derived from red-team findings in:
- `docs/research/VERIFICATION-CLAIM-MEMBERSHIP-EPOCH-REDTEAM-2026-03-10.md`

Goal: prevent stale/split membership views from producing false quorum confidence.

## Task 1 — Stale-Epoch + Split-View Quorum Guard
- Detect replayed stale epoch evidence (`membership-epoch-stale`).
- Enforce same-epoch consistency across quorum proof bundle (`membership-epoch-split-view`).

### Acceptance criteria
1. Stale-epoch replay fixture fails deterministically.
2. Split-view quorum fixture fails deterministically.
3. Same-epoch fresh quorum fixture passes deterministically.

---

## Task 2 — Transition Stabilization + Canonical Epoch-ID Validation
- Enforce join/leave stabilization dwell rules (`membership-epoch-transition-unstable`).
- Validate canonical epoch-id hashing; reject aliases (`membership-epoch-id-invalid`).

### Acceptance criteria
1. Transition-window abuse fixture fails deterministically.
2. Epoch-id aliasing fixture fails deterministically.
3. Stable transition + canonical id fixture passes deterministically.

---

## Task 3 — Epoch Metadata Completeness Contract
- Require full epoch metadata (version, context, transition markers).
- Reject partial metadata bundles (`membership-epoch-evidence-incomplete`).

### Acceptance criteria
1. Partial metadata fixture fails deterministically.
2. Complete metadata fixture passes with deterministic artifact hash.
3. Identical inputs produce identical verdicts/artifact hashes.

## Next Task (single)
Lane B: implement Task 1 in simulation/tooling scope (stale-epoch + split-view quorum evaluator + fixtures), no publish-path wiring in same change.
