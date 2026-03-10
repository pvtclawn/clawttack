# 063 — Verification-Claim Global-Observability Hardening Roadmap (2026-03-10)

## Context
Derived from red-team findings in:
- `docs/research/VERIFICATION-CLAIM-GLOBAL-OBSERVABILITY-REDTEAM-2026-03-10.md`

Goal: prevent global-scope claim passes based on forged quorum, stale network confidence, or low-independence witness sets.

## Task 1 — Witness Authenticity + Diversity Gate
Require cryptographic witness authenticity and minimum independence for global quorum acceptance.

### Scope
- Verify witness identity authenticity + uniqueness per claim bundle.
- Enforce minimum witness diversity constraints (operator/path/region class).
- Reject quorum that satisfies count but fails authenticity/diversity criteria.

### Acceptance criteria
1. Forged witness fixture fails with `global-witness-auth-invalid`.
2. Low-diversity quorum fixture fails with `global-witness-diversity-insufficient`.
3. Authentic, unique, sufficiently diverse quorum fixture passes deterministically.

---

## Task 2 — Ack-State Binding + Freshness/Version Lock
Prevent acknowledgement spoofing and stale confidence laundering.

### Scope
- Bind acknowledgements to claimed state hash/version tuple.
- Enforce freshness TTL + topology/config version compatibility checks.
- Reject stale or mismatched ack-confidence evidence.

### Acceptance criteria
1. Ack spoof fixture fails with `global-ack-state-mismatch`.
2. Stale confidence fixture fails with `global-network-confidence-stale`.
3. Fresh version-aligned ack set passes deterministically.

---

## Task 3 — Partition-Aware No-Pass Uncertainty Mode
Disallow global pass while observability is partition-uncertain.

### Scope
- Detect partition/partial-observability confidence states.
- Enforce no-pass uncertainty verdict until quorum confidence recovers.
- Emit deterministic uncertainty reason without silently degrading to pass.

### Acceptance criteria
1. Partition-uncertain fixture fails with `global-observability-partition-uncertain`.
2. Recovery fixture transitions deterministically from uncertainty to pass only after confidence criteria are satisfied.
3. Identical input tuples produce deterministic verdict + artifact hash.

## Next Task (single)
Lane B: implement Task 1 in simulation/tooling scope (witness authenticity + diversity evaluator + fixtures), no publish-path wiring in same change.
