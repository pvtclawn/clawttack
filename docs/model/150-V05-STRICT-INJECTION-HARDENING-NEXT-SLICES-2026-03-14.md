# 150 — V05 strict-injection hardening next slices

- **Date:** 2026-03-14 11:49 (Europe/London)
- **Scope:** `packages/sdk/scripts/summarize-v05-batches.py`
- **Lane:** A (PLAN)

## Context
Task source: `docs/research/REDTEAM-V05-STRICT-INJECTION-SCOPE-2026-03-14-1144.md`.

Current strict-mode coverage proves one contamination class (`label-hygiene collapse`) with output-boundary write-then-fail behavior. Remaining risk is false confidence from single-class coverage and unstable violation ordering.

## Task 1 (P0): Multi-class strict-injection coverage harness
Add deterministic injection scenarios (at minimum):
1. label-hygiene collapse,
2. mixed `maxTurnsConfigured` comparability violation,
3. combined multi-violation case.

### Acceptance criteria
1. Each scenario emits persisted aggregate diagnostics before strict exit.
2. `strictViolationCount` and `strictViolations[]` match expected class set for each scenario.
3. Combined scenario reports both classes (no silent dropping).

## Task 2 (P0): Canonical strict ordering contract
Define and enforce canonical class order for `warnings[]` and `strictViolations[]`.

### Acceptance criteria
1. Re-running same inputs yields byte-stable ordering in JSON.
2. Markdown mirrors JSON ordering exactly.
3. Combined scenario ordering stays deterministic across runs.

## Task 3 (P1): Contamination counters in strict diagnostics
Add orthogonal counters aligned to strict classes:
- `labelContaminationCount`
- `maxTurnsContaminationCount`

### Acceptance criteria
1. Counters are present in aggregate JSON and markdown guardrails section.
2. Counters align with class-specific strict violations in injection scenarios.
3. Clean labeled run keeps counters at zero.

## Priority order
1. Task 1
2. Task 2
3. Task 3

## Next Task (single)
Lane B: implement **Task 1 only** — multi-class strict-injection coverage checks (label collapse, max-turns mismatch, combined case) with persisted strict diagnostics and deterministic expected violation sets.
