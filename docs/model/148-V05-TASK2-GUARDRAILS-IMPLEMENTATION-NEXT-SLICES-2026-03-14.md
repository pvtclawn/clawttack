# 148 — V05 Task 2 Guardrails Implementation Next Slices (2026-03-14)

## Context
Task 1 aggregate turn-budget accounting is now implemented and parity-verified.
Next blocker is interpretation safety: Task 2 guardrails must prevent false-green labels, mixed-population comparability errors, and silent denominator contamination.

## Task 1 (next) — JSON-first guardrail contract
Implement machine-readable aggregate guardrails under `interventionTargetMetrics`:
- `labelHygieneOk`
- `maxTurnsComparable`
- `warnings[]` (structured warning codes/messages)

### Acceptance criteria
1. Guardrail status exists in aggregate JSON (not markdown-only).
2. `warnings[]` always present (empty array when clean).
3. Existing turn-budget denominator fields remain unchanged and still intervention-scoped.

## Task 2 — Label hygiene normalization + counters
Harden label checks beyond non-empty strings:
- normalize labels (`trim`, case-stable compare)
- require distinct control/intervention labels
- report counters for contaminated population (`missingLabelCount`, `blankLabelCount`, `sameLabelCount`)

### Acceptance criteria
1. Non-meaningful labels (blank/whitespace/same control+intervention) set `labelHygieneOk=false`.
2. Counter fields are emitted in JSON and mirrored in markdown.
3. Aggregate warning includes explicit remediation hint.

## Task 3 — Max-turn comparability from observed artifacts
Compute comparability from observed per-battle metrics (not CLI intent):
- detect unique `maxTurnsConfigured` values across included intervention population
- emit `maxTurnsComparable=false` when unique count > 1
- include `observedMaxTurnsValues` for auditability

### Acceptance criteria
1. Mixed observed max-turn values trigger `maxTurnsComparable=false` with warning.
2. `observedMaxTurnsValues` is present and sorted for deterministic diffs.
3. Markdown summary mirrors comparability status and value list.

## Priority
1) Task 1, 2) Task 2, 3) Task 3.

## Why this order
Task 1 establishes fail-closed machine-readable guardrails first. Task 2 closes false-green label loopholes. Task 3 hardens comparability against real artifact drift before further intervention claims.
