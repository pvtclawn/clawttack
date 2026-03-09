# 034 — Guardrail Coupling Budget Gate Plan (2026-03-09)

Input: `memory/reading-notes/2026-03-09--coupling-budget-for-guardrail-change-safety.md`

## Motivation
As guardrail modules accumulate, change risk shifts from single-module correctness to cross-module coupling. We need explicit coupling-budget controls so mechanism evolution remains auditable and cost-effective to change.

## Proposed delta (simulation/tooling-first)
Introduce a coupling-budget gate for protocol guardrail changes.

### Required artifacts per change
1. module touch-set declaration
2. dependency-edge snapshot (before/after)
3. coupling delta summary (new edges, fan-in/fan-out movement)

### Gate policy
- pass when coupling delta is within threshold,
- fail when threshold exceeded without explicit waiver artifact,
- waiver requires rationale + expected rollback plan.

## Acceptance criteria
1. Every mechanism change emits before/after dependency-edge snapshots.
2. Coupling delta score is deterministic for identical snapshots.
3. Unwaived over-budget deltas fail gate deterministically.
4. Waived over-budget deltas include reason + rollback metadata in artifact.

## Minimal next task
Implement a pure TypeScript coupling-delta helper that compares two dependency snapshots and emits deterministic verdict + reason codes (`pass`, `budget-exceeded`, `waived-over-budget`), with fixture tests for each branch.
