# 036 — Feedback Cadence Budget Gate Plan (2026-03-09)

Input: `memory/reading-notes/2026-03-09--feedback-cadence-budget-from-vibe-coding.md`

## Motivation
Guardrail evolution speed has increased. Verification must scale with this speed; otherwise risk accumulates between checks even if individual checks are green.

## Proposed delta (simulation/tooling-first)
Introduce a cadence-budget gate linking change velocity to required verification frequency.

### Inputs per window
1. `changesPerWindow`
2. `verifyIntervalMinutes`
3. `windowSizeMinutes`
4. `criticalityWeight` (higher for mechanism-touching changes)

### Policy
- compute required max verify interval as function of velocity × criticality
- verdicts:
  - `cadence-ok`
  - `cadence-warning`
  - `cadence-budget-exceeded`

## Acceptance criteria
1. Burst-velocity windows fail when verification cadence is too slow.
2. Low-velocity windows pass without false hard fails.
3. Identical windows produce deterministic cadence verdicts.
4. Verdict artifact includes computed requirement and observed interval.

## Minimal next task
Implement a pure TypeScript cadence-gate helper with fixture tests for low/medium/burst velocity windows and deterministic verdict reasons (`cadence-ok`, `cadence-warning`, `cadence-budget-exceeded`), with no production runtime behavior changes in the same PR.
