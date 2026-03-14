# 151 — V05 intervention-batch execution next slices (2026-03-14)

## Goal
Run one intervention-labeled low-volume batch variation that is still interpretation-safe under tiny sample sizes.

## Task 1 (P0): config-fingerprint + single-variable guardrail
Implement run-level configuration fingerprinting in summary artifacts and enforce single-variable intervention scope.

### Acceptance criteria
1. Aggregate JSON includes `runConfigFingerprint` generated from the executed run configuration.
2. Aggregate JSON includes explicit drift guard result (`singleVariableInterventionOk`) with warnings/strict violation when extra knobs drift.
3. Comparison artifact carries both current and previous run fingerprints so drift is auditable.

## Task 2 (P0): intervention evidence bundle in aggregate outputs
Add a mandatory intervention evidence bundle that pairs budget use with confounders.

### Acceptance criteria
1. Aggregate JSON reports (same artifact):
   - turn-budget usage metrics,
   - unsettled battle count,
   - first-mover distribution.
2. Aggregate Markdown mirrors the same bundle in one section for review parity.
3. Missing bundle fields trigger warnings (and strict violation in `--strict`).

## Task 3 (P1): exploratory-confidence caveat + strict default run path
Make tiny-sample confidence boundaries explicit and keep strict mode on for intervention runs.

### Acceptance criteria
1. Aggregate Markdown contains an explicit exploratory-confidence caveat block for low-volume intervention batches.
2. Intervention run command/docs use strict mode by default (`--strict`).
3. Strict failures preserve write-then-fail behavior with persisted diagnostics.

## Priority and next slice
Priority order: Task 1 → Task 2 → Task 3.

Immediate next task: implement **Task 1 only** in `packages/sdk/scripts/summarize-v05-batches.py`, then verify clean vs drifted-label/config runs under strict mode.
