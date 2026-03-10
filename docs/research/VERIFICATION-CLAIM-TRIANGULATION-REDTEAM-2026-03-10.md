# Verification-Claim Triangulation Gate — Red-Team Report (2026-03-10)

## Scope
Review target:
- `docs/model/050-VERIFICATION-CLAIM-MULTI-PERSPECTIVE-TRIANGULATION-PLAN-2026-03-10.md`

Goal: identify ways a claim can satisfy multi-perspective checks while still overclaiming or omitting critical system truth.

## Findings

### 1) Perspective-tag spoofing
**Vector:** relabel artifact evidence as operational context.

**Failure mode:** gate accepts synthetic dual-perspective bundle.

**Mitigation:** provenance-enforced perspective typing with deterministic reason `perspective-provenance-invalid`.

---

### 2) Stale operational signal abuse
**Vector:** replay old route/on-chain/runtime snapshots outside freshness bounds.

**Failure mode:** claim appears operationally corroborated while live state diverged.

**Mitigation:** freshness TTL + version/commit binding, fail with `operational-signal-stale`.

---

### 3) Policy downgrade bypass
**Vector:** classify runtime-strength claims as lower-tier classes needing fewer perspectives.

**Failure mode:** claim bypasses required triangulation policy.

**Mitigation:** class-policy lock + required class justification hash; fail with `claim-class-policy-mismatch`.

---

### 4) Cross-perspective causal mismatch
**Vector:** supply valid artifact + valid operational evidence from different scope/version windows.

**Failure mode:** formal triangulation passes despite no causal linkage.

**Mitigation:** shared scope/version anchor key across all evidence; fail with `cross-perspective-scope-mismatch`.

---

### 5) Asymmetric failure masking
**Vector:** overweight one strong perspective to hide critical failure in another.

**Failure mode:** composite scoring passes despite critical operational risk.

**Mitigation:** non-compensable critical-perspective fail rules; reason `critical-perspective-fail`.

## Proposed hardening tasks
1. Add perspective provenance + freshness-bound operational evidence checks.
2. Add class-policy lock + claim-class justification binding.
3. Add cross-perspective scope/version anchor and non-compensable failure policy.

## Acceptance criteria for next lane
- Fixture with spoofed perspective tag must fail deterministically.
- Fixture with stale operational evidence must fail deterministically.
- Fixture with policy downgrade attempt must fail deterministically.
- Fixture with cross-scope triangulation must fail deterministically.
- Fixture with critical operational failure must fail even if artifact evidence is strong.
