# 017 — Risk-Aware Rating Hardening Roadmap (2026-03-09)

Input artifact: `memory/challenges/2026-03-09--risk-aware-rating-red-team.md`

## Goal
Convert risk-aware-rating red-team concerns into minimal, merge-sized tasks with explicit verification gates.

---

## Task 1 (P0): Confidence provenance + anti-manipulation guardrails

### Scope
- Partition confidence features into:
  1. chain-derived (preferred),
  2. off-chain asserted (degraded trust).
- Add conservative fallback when asserted evidence is missing/invalid.
- Define detector signals for repeated self-induced uncertainty patterns.

### Acceptance criteria
1. Confidence computation reports provenance for each feature.
2. Missing unverifiable evidence cannot increase confidence.
3. Adversarial fixtures with repeated self-induced uncertainty are flagged.

---

## Task 2 (P0): Explainability contract for rating updates

### Scope
- Emit per-battle explanation payload:
  - `baseDelta`, `confidence`, `adjustedDelta`, feature snapshot, provenance flags.
- Keep schema versioned and deterministic.

### Acceptance criteria
1. Every adjusted update includes complete explanation payload.
2. Re-running the same input produces byte-identical explanation output.
3. Versioned schema diff is explicit and backward-compatible.

---

## Task 3 (P1): Mode comparability and rollout policy

### Scope
- Define mode-conditioned leaderboard policy during rollout.
- Prevent silent mixing of baseline and risk-aware rating streams.
- Document migration criteria for combining modes.

### Acceptance criteria
1. Simulation reports baseline vs risk-aware ladders separately.
2. No cross-mode ranking merge without explicit migration toggle.
3. Migration checklist includes calibration thresholds and sign-off criteria.

---

## Next Task (single)
Implement Task 1 in simulation-only utility (no production rating impact), including provenance tagging and conservative fallback tests.
