# 075 — Verification-Claim Synchrony-Regime Hardening Roadmap (2026-03-10)

## Context
Derived from red-team findings in:
- `docs/research/VERIFICATION-CLAIM-SYNCHRONY-REGIME-REDTEAM-2026-03-10.md`

Goal: prevent async-window liveness overclaims, fake-sync signaling, and safety-override leakage under degraded synchrony conditions.

## Task 1 — Synchrony Signal Authenticity + Window Completeness
Require trusted synchrony telemetry and complete async-window accounting.

### Scope
- Validate synchrony regime signal provenance/authenticity.
- Enforce complete time-window accounting for async intervals.
- Reject forged sync signals and truncated async exposure logs.

### Acceptance criteria
1. Fake-sync telemetry fixture fails with `synchrony-signal-invalid`.
2. Async-window suppression fixture fails with `synchrony-window-incomplete`.
3. Authentic complete synchrony window evidence passes deterministically.

---

## Task 2 — Downgrade Immutability + Safety Override Protection
Disallow remapping downgraded liveness states and preserve safety hard-fail across regimes.

### Scope
- Enforce non-remappable liveness downgrade reason contract.
- Apply regime-invariant safety hard-fail policy.
- Reject async-mode policy paths that soften safety constraints.

### Acceptance criteria
1. Downgrade-remap fixture fails with `synchrony-downgrade-remap-invalid`.
2. Safety-override fixture fails with `synchrony-safety-override-invalid`.
3. Policy-compliant downgrade with intact safety semantics passes deterministically.

---

## Task 3 — Regime Hysteresis + Dwell-Time Anti-Flap Controls
Prevent threshold oscillation from masking instability.

### Scope
- Require hysteresis boundaries for sync↔async transitions.
- Enforce minimum dwell-time before regime flips are accepted.
- Detect and hard-fail pathological regime flapping.

### Acceptance criteria
1. Regime-flapping fixture fails with `synchrony-regime-flap-detected`.
2. Stable regime transition fixture passes with deterministic verdict.
3. Identical input tuples yield deterministic verdict + artifact hash.

## Next Task (single)
Lane B: implement Task 1 in simulation/tooling scope (synchrony signal authenticity + window completeness evaluator + fixtures), no publish-path wiring in same change.
