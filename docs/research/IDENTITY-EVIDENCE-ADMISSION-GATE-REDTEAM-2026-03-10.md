# Identity-Evidence Admission Gate — Red-Team Review (2026-03-10)

## Scope
Red-team review of:
- `docs/model/038-IDENTITY-EVIDENCE-ADMISSION-GATE-PLAN-2026-03-10.md`

Objective challenged: deterministic identity-evidence gating for rated battle admission.

## Critical weaknesses

### 1) Sybil-friendly evidence floor
**Failure mode:** A minimal threshold (e.g., count-based attestations) can be gamed by rotating low-cost identities that meet the floor.

**Risk:** Rated lane still admits low-quality adversaries; gate adds complexity without materially reducing spam pressure.

**Mitigation:**
- replace count-only checks with weighted evidence quality,
- require issuer diversity and minimum history age,
- apply concentration penalties when identity graph is tightly clustered.

---

### 2) Attestation laundering / trust-ring spoofing
**Failure mode:** Collusive actors can mutually attest and create synthetic trust.

**Risk:** Deterministic gate accepts fabricated credibility with high confidence language.

**Mitigation:**
- add anti-collusion graph signals (issuer overlap, reciprocity loops),
- include issuer reputation tiers and downgrade unverifiable issuers,
- require deterministic `issuer-diversity-insufficient` reason path.

---

### 3) Mode-selection bias (rated vs unrated)
**Failure mode:** Agents can strategically avoid rated lane when their evidence is weak, re-entering only when favorable.

**Risk:** Rated outcomes become selection-biased; observed reliability is overstated.

**Mitigation:**
- emit per-agent lane-selection telemetry,
- report rated-entry acceptance rates with confidence bounds,
- add explicit `mode-selection-bias-risk` flag in summary artifacts.

---

### 4) Stale evidence acceptance window
**Failure mode:** Admission checks rely on delayed snapshots; revoked/degraded agents still pass during lag.

**Risk:** Gate correctness drifts under asynchronous updates.

**Mitigation:**
- bind checks to block-height-stamped evidence snapshots,
- enforce freshness max-age,
- deterministic `evidence-stale` rejection reason for rated lane.

---

### 5) Liveness regression from strict schema fail-close
**Failure mode:** strict schema invalidation blocks benign participants on minor encoding/version mismatches.

**Risk:** Reliability suffers; attackers can trigger churn by inducing harmless format drift.

**Mitigation:**
- preserve fail-closed rated decision,
- add bounded deterministic resync path for non-malicious mismatches,
- include schema-version negotiation metadata.

## Recommended hardening direction
Convert this red-team output into a constrained roadmap with 3 tasks:
1. anti-sybil and anti-collusion admission score,
2. freshness-bound evidence snapshot policy,
3. mode-selection bias observability + reporting guard.

No production gate promotion before all 3 tasks have fixture-backed acceptance criteria.
