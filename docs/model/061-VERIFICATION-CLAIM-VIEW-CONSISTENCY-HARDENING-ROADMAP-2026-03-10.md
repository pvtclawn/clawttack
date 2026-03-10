# 061 — Verification-Claim View-Consistency Hardening Roadmap (2026-03-10)

## Context
Derived from red-team findings in:
- `docs/research/VERIFICATION-CLAIM-VIEW-CONSISTENCY-REDTEAM-2026-03-10.md`

Goal: prevent local/module evidence from being mislabeled or overgeneralized into global/system certainty.

## Task 1 — View-Tag Provenance + Freshness Validation
Require proof that each evidence item’s declared view level is authentic and current.

### Scope
- Bind each evidence item to a provenance-attested view tag (`local`/`holon`/`global`).
- Enforce freshness constraints by view tier, with stricter requirements at higher scope.
- Hard-fail forged tags or stale high-view evidence.

### Acceptance criteria
1. Forged view-tag fixture fails with `view-tag-provenance-invalid`.
2. Stale global-view evidence fixture fails with `view-evidence-stale`.
3. Fresh, provenance-valid view-tag bundle passes this gate deterministically.

---

## Task 2 — Claim Scope/Text Consistency + Anti-Laundering Invariants
Block scope inflation in user-facing text and local-to-global evidence laundering.

### Scope
- Validate that claim text implication matches declared claim scope.
- Reject local-evidence aggregation being represented as global proof.
- Emit deterministic mismatch reasons for metadata/text divergence.

### Acceptance criteria
1. Scope-text mismatch fixture fails with `view-scope-text-mismatch`.
2. Local-aggregate-as-global fixture fails with `view-laundering-detected`.
3. Scope-aligned claim/evidence fixture passes this gate deterministically.

---

## Task 3 — Required-View Completeness Contract + Deterministic Completeness Hash
Ensure required evidence views cannot be omitted or substituted with lower-view filler.

### Scope
- Define required minimum evidence-view set by claim scope.
- Compute deterministic completeness hash across required view slots.
- Fail when required view is missing even if local evidence volume is high.

### Acceptance criteria
1. Missing required-view fixture fails with `view-evidence-incomplete`.
2. Complete required-view fixture yields deterministic completeness hash and pass verdict.
3. Identical input tuples produce deterministic verdict + reason + artifact hash.

## Next Task (single)
Lane B: implement Task 1 in simulation/tooling scope (view-tag provenance + freshness evaluator + fixtures), no publish-path wiring in same change.
