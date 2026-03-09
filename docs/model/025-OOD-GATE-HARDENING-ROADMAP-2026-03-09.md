# 025 — OOD Gate Hardening Roadmap (2026-03-09)

Input artifact: `memory/challenges/2026-03-09--ood-generalization-gate-red-team.md`

## Goal
Convert OOD-gate red-team risks into merge-sized tasks with explicit acceptance criteria and governance-safe thresholds.

---

## Task 1 (P0): Holdout anti-leakage execution discipline

### Scope
- Rotate holdout fixture IDs + seed schedules per evaluation window.
- Split holdout logs from developer-facing diagnostics.
- Redact holdout-specific failure fingerprints from default outputs.

### Acceptance criteria
1. Holdout fixture identifiers differ across configured windows.
2. Developer-visible reports exclude holdout-specific failure signatures.
3. Leakage audit checklist passes before holdout verdict publication.

---

## Task 2 (P0): Deterministic metric-floor + gap governance

### Scope
- Require per-metric floors (pass/precision/liveness) alongside composite score.
- Freeze threshold set per evaluation window and version it.
- Disallow retroactive threshold edits for already-evaluated runs.

### Acceptance criteria
1. Gate verdict contains per-metric floor result + composite result.
2. Threshold version is embedded in every verdict artifact.
3. Threshold mutation after run completion yields deterministic `threshold-version-mismatch` failure.

---

## Task 3 (P1): Variance-aware holdout sizing + channel separation

### Scope
- Enforce minimum holdout sample size and confidence interval reporting.
- Return deterministic `holdout-sample-too-small` when size is insufficient.
- Separate experimental (non-promotable) and release-candidate gate channels.

### Acceptance criteria
1. Holdout insufficiency cannot produce promotable pass verdict.
2. Verdict artifact includes confidence interval + sample size fields.
3. Experimental channel outputs are explicitly labeled non-promotable by schema.

---

## Next Task (single)
Implement Task 2 first as a simulation-only OOD gate utility (metric floors + threshold version binding + immutable verdict checks), with no production promotion logic changes in the same PR.
