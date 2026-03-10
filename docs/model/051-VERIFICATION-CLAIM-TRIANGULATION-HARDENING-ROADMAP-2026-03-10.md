# 051 — Verification-Claim Triangulation Hardening Roadmap (2026-03-10)

## Context
Derived from red-team findings in:
- `docs/research/VERIFICATION-CLAIM-TRIANGULATION-REDTEAM-2026-03-10.md`

Goal: prevent false-positive triangulation passes where evidence appears multi-perspective but is stale, mismatched, downgraded, or spoofed.

## Task 1 — Perspective Provenance + Freshness Gate
Require deterministic provenance and freshness constraints for perspective-tagged evidence.

### Scope
- Validate perspective source type (`artifact` vs `operational`) with explicit provenance metadata.
- Require operational evidence TTL and version/commit binding.
- Reject spoofed or stale operational perspective claims.

### Acceptance criteria
1. Fixture with artifact evidence relabeled as operational fails with deterministic reason `perspective-provenance-invalid`.
2. Fixture with stale operational evidence fails with deterministic reason `operational-signal-stale`.
3. Fixture with valid provenance + fresh operational signal passes this gate.

---

## Task 2 — Claim-Class Policy Lock + Justification Binding
Prevent silent downgrade of claim class to weaker policy requirements.

### Scope
- Enforce immutable mapping: claim class -> required perspectives.
- Require class justification hash in verdict payload.
- Fail when declared class/policy requirement and claim text intent diverge.

### Acceptance criteria
1. Downgrade attempt fixture fails with `claim-class-policy-mismatch`.
2. Missing/invalid class justification hash fails deterministically.
3. Valid class-policy match with justification hash passes.

---

## Task 3 — Cross-Perspective Scope Anchor + Non-Compensable Failure Rule
Require causal linkage between perspectives and prevent weighted masking of critical failures.

### Scope
- Enforce shared scope/version anchor key across all required perspectives.
- Any critical operational failure must hard-fail regardless of artifact strength.
- No compensatory scoring can override critical perspective failure.

### Acceptance criteria
1. Cross-scope evidence bundle fails with `cross-perspective-scope-mismatch`.
2. Fixture with critical operational failure fails with `critical-perspective-fail` even if artifact score is high.
3. Fixture with aligned scope anchors and no critical failures passes.

## Next Task (single)
Lane B: implement Task 1 in simulation/tooling scope (provenance+freshness evaluator + fixtures), no publish-path wiring in same change.
