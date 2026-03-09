# 035 — Coupling-Budget Hardening Roadmap (2026-03-09)

Input artifact: `memory/challenges/2026-03-09--coupling-budget-gate-red-team.md`

## Goal
Convert coupling-budget gate red-team findings into merge-sized tasks with deterministic acceptance gates.

---

## Task 1 (P0): Snapshot integrity + extraction confidence gate

### Scope
- Generate dependency snapshots from multiple extractors (static imports + AST edge pass).
- Emit extraction coverage/confidence metadata (files seen, parse coverage, edge-source counts).
- Fail closed when confidence/coverage drops below required floor.

### Acceptance criteria
1. Low-confidence snapshot runs fail deterministically (`snapshot-confidence-too-low`).
2. Snapshot artifact includes coverage + extractor-consistency fields.
3. Identical source trees produce identical snapshot fingerprints.

---

## Task 2 (P0): Waiver governance controls

### Scope
- Add waiver quota per evaluation window/module.
- Require waiver expiry and rollback plan metadata.
- Escalate repeated waiver usage into deterministic review-required status.

### Acceptance criteria
1. Waiver overuse triggers deterministic `waiver-quota-exceeded`.
2. Missing expiry/rollback fields fail with deterministic metadata reason.
3. Repeated waivers emit escalation flag in gate artifact.

---

## Task 3 (P1): Multi-axis coupling limits + baseline version lock

### Scope
- Track coupling along multiple non-compensable axes (fan-in, fan-out, edge novelty, indirection estimate).
- Disallow aggregate-pass when critical axis breaches threshold.
- Version-lock baseline snapshot tooling/schema and reject mismatches.

### Acceptance criteria
1. Critical-axis breach fails even if aggregate score is nominal.
2. Indirection-growth signals affect coupling verdicts.
3. Baseline/tooling version mismatch returns deterministic hard fail.

---

## Next Task (single)
Implement Task 1 first in simulation/tooling helper (multi-extractor snapshot confidence + deterministic fail-closed path), with no production behavior changes in the same PR.
