# 149 — V05 strict-mode + contamination counters next slices

- **Date:** 2026-03-14 11:19 (Europe/London)
- **Scope:** `packages/sdk/scripts/summarize-v05-batches.py`
- **Lane:** A (PLAN)

## Context
Task source: `docs/research/REDTEAM-V05-STRICT-MODE-CONTAMINATION-COUNTERS-2026-03-14-1114.md`.

Current guardrail contract exists (`labelHygieneOk`, `maxTurnsComparable`, `warnings[]`) but strict-mode execution semantics and orthogonal contamination counters are not yet implemented.

## Task 1 (P0): JSON-first strict diagnostics + output-boundary strict exit
Implement strict-mode contract fields and fail-after-write semantics:
- add aggregate JSON fields:
  - `strictMode`
  - `strictViolationCount`
  - `strictViolations[]` (deterministic ordered hard-violation keys)
- write aggregate JSON/Markdown diagnostics first,
- evaluate strict-mode exit only after write completion.

### Acceptance criteria
1. Aggregate JSON is produced even when strict mode would fail.
2. Process exits non-zero iff `strictMode=true && strictViolationCount>0`.
3. `strictViolations[]` ordering is deterministic for stable diffs.
4. Markdown guardrail section mirrors JSON strict fields exactly.

## Task 2 (P0): Orthogonal contamination counters + deterministic warning policy
Split contamination metrics into distinct machine-readable counters:
- `labelContaminationCount`
- `maxTurnsContaminationCount`
- `sourceFreshnessContaminationCount` (if freshness checks are available in current input scope)
- preserve existing `warnings[]` but classify hard-violation eligibility explicitly.

### Acceptance criteria
1. Counters are independent (no umbrella conflation).
2. `strictViolationCount` equals deterministic count of hard violations only.
3. Non-hard anomalies remain warnings without strict failure.
4. JSON values are mirrored in Markdown with parity.

## Task 3 (P1): Current-source-only violation evaluation
Prevent stale-output contamination by constraining checks to selected run inputs:
- evaluate guardrails from selected batch logs/checkpoints only,
- do not read prior generated summaries as violation inputs,
- emit source-scope metadata in aggregate output.

### Acceptance criteria
1. Violation/counter computation is derived only from current selected artifacts.
2. Aggregate output includes source-scope metadata (e.g., selected batches/count).
3. Re-running without input changes yields stable counters/warnings.

## Priority order
1. Task 1
2. Task 2
3. Task 3

## Next Task (single)
Lane B: implement **Task 1 only** — JSON-first strict diagnostics and output-boundary strict exit semantics in `packages/sdk/scripts/summarize-v05-batches.py`, then verify with one strict-off and one strict-on run.