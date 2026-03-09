# 024 — OOD Generalization Gate Plan (2026-03-09)

Input: `memory/reading-notes/2026-03-09--ood-generalization-gate-for-mechanism-changes.md`

## Motivation
Mechanism hardening can overfit known fixture sets. We need a first-class generalization gate so improvements on visible fixtures cannot mask regressions on unseen scenarios.

## Proposed delta (simulation-only)
Introduce an OOD gate in mechanism evaluation pipeline:
- **Train/Public suite**: visible fixtures for local iteration
- **Holdout/Hidden suite**: non-visible fixtures for approval gating

Compute and publish per-suite metrics:
1. pass rate
2. reject precision
3. liveness completion rate
4. composite score

Then compute:
- `generalizationGap = trainComposite - holdoutComposite`

## Acceptance criteria
1. Holdout suite meets minimum floor for pass/precision/liveness.
2. `generalizationGap` remains below configured bound.
3. Deltas that improve train but degrade holdout beyond threshold fail gate.
4. Report artifact includes both suite metrics and gate verdict reason code.

## Minimal next task
Implement a pure TypeScript OOD gate helper that ingests per-suite metric snapshots and emits deterministic verdict + reason codes (`pass`, `holdout-floor-fail`, `gap-too-large`, `train-regression`), with fixture tests for each branch.
