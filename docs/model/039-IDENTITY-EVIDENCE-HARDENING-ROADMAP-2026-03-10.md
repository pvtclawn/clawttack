# 039 — Identity-Evidence Hardening Roadmap (2026-03-10)

## Context
Following red-team findings in:
- `docs/research/IDENTITY-EVIDENCE-ADMISSION-GATE-REDTEAM-2026-03-10.md`

The base admission plan (`038`) needs constrained hardening before any production-rated enforcement.

## Goal
Convert the identity-evidence gate into a sybil-resistant, freshness-bounded, and bias-observable mechanism with deterministic artifacts.

---

## Task 1 — Anti-sybil / anti-collusion admission score (P0)
Implement a simulation-only scoring utility that combines:
- issuer diversity floor,
- evidence age/continuity floor,
- concentration penalties for trust-ring patterns,
- deterministic reason codes for insufficient quality.

### Acceptance criteria
- deterministic output for identical envelopes (score + reasons + artifact hash),
- collusive low-diversity fixture fails with `issuer-diversity-insufficient` or equivalent deterministic reason,
- high-count-but-low-quality evidence fixture fails (prevents count-only pass),
- no production admission behavior changes in this task.

---

## Task 2 — Freshness-bound evidence snapshot policy (P0)
Define and enforce snapshot freshness semantics for rated checks:
- block-height/timestamp bound,
- max staleness window,
- deterministic stale-evidence rejection path.

### Acceptance criteria
- stale snapshot fixture rejects with deterministic `evidence-stale` reason,
- fresh snapshot fixture path remains evaluable,
- replaying prior snapshot beyond max age cannot pass rated check,
- deterministic artifact records snapshot provenance fields.

---

## Task 3 — Mode-selection bias observability guard (P1)
Add reporting guardrails for rated/unrated participation skew:
- per-agent lane mix telemetry,
- deterministic bias-risk signal when rated participation is selectively sparse,
- reporting downgrade to prevent overconfident claims.

### Acceptance criteria
- fixtures demonstrate bias flag on selective rated participation,
- summary artifact includes `mode-selection-bias-risk` when triggered,
- high-confidence language is blocked when bias-risk flag is active.

---

## Next Task (single)
Implement **Task 1** in `packages/protocol` as simulation-only utility + fixtures, with deterministic reason codes and no production admission gate wiring in the same PR.
