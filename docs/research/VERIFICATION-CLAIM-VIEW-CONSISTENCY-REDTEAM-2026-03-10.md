# Verification-Claim View-Consistency Gate — Red-Team Report (2026-03-10)

## Scope
Review target:
- `docs/model/060-VERIFICATION-CLAIM-VIEW-CONSISTENCY-GATE-PLAN-2026-03-10.md`

Goal: identify how local/module evidence could still be represented as global/system certainty despite view-level gating.

## Findings

### 1) View-tag spoofing
**Vector:** evidence submitted with forged `holon/global` tags.

**Failure mode:** gate accepts escalated view claims without source-grade provenance.

**Mitigation:** provenance-bound view tags; fail with `view-tag-provenance-invalid`.

---

### 2) Scope inflation via language mismatch
**Vector:** claim metadata says `local`, narrative text implies `global` certainty.

**Failure mode:** policy checks metadata only; user-facing text overclaims.

**Mitigation:** scope-text consistency gate; fail with `view-scope-text-mismatch`.

---

### 3) Local-to-global laundering
**Vector:** many local checks aggregated and presented as global evidence.

**Failure mode:** quantity of local evidence misread as system-level proof.

**Mitigation:** anti-laundering invariant (`local-aggregate-not-global`), deterministic fail reason `view-laundering-detected`.

---

### 4) Cross-view stale blending
**Vector:** stale global evidence combined with fresh local evidence.

**Failure mode:** mixed recency bundle passes despite outdated top-level view.

**Mitigation:** per-view freshness TTL with strict highest-scope freshness requirement; fail `view-evidence-stale`.

---

### 5) Missing-view omission masking
**Vector:** required high-level view missing; extra local evidence used as filler.

**Failure mode:** apparent evidence richness hides required-view absence.

**Mitigation:** strict required-view contract and completeness hash; fail `view-evidence-incomplete`.

## Proposed hardening tasks
1. Add view-tag provenance + freshness-bound validation.
2. Add scope-text consistency + anti-laundering invariants.
3. Add strict required-view completeness hash with deterministic fail codes.

## Acceptance criteria for next lane
- Forged view-tag fixture fails deterministically.
- Scope/text mismatch fixture fails deterministically.
- Local-aggregate-as-global fixture fails deterministically.
- Stale high-view evidence fixture fails deterministically.
- Missing required-view fixture fails deterministically.
