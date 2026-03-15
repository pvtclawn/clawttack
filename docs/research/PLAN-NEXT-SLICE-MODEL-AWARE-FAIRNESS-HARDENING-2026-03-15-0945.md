# Plan — next smallest mergeable model-aware fairness hardening slice (2026-03-15 09:45 UTC)

## Context
Latest challenge on model-aware per-key fairness calibration identified evasion vectors:
1. active-key inflation via dust-key injection,
2. evidence-window slicing/reset manipulation,
3. denominator distortion against deviation multipliers,
4. threshold oscillation camouflage.

Goal: choose one smallest high-leverage implementation slice with deterministic acceptance criteria.

## Candidate tasks

### Task 1 — Active-key contribution floor + dust-key exclusion (smallest)
- **Scope:** fairness metric preprocessing only.
- **Change:** include keys in `fairnessModelActiveKeyCount` only if they meet a minimum defer-count contribution floor.
- **Trigger:** `hard-invalid:fairness-active-key-inflation-suspected` when dust-key inflation pattern exceeds configured ratio.
- **Acceptance criteria:**
  1. balanced non-dust fixture keeps active-key count stable and emits no inflation trigger,
  2. synthetic dust-key injection fixture is excluded from active-key baseline and emits inflation trigger,
  3. top claim-limiting reason uses inflation trigger when no higher-priority invalid exists.

### Task 2 — Monotonic rolling evidence-window guard
- **Scope:** fairness evaluation window handling.
- **Change:** prevent reset/slicing evasion by enforcing monotonic window progression + anti-reset checks.
- **Trigger:** `hard-invalid:fairness-evidence-window-manipulation`.
- **Acceptance criteria:** reset-manipulation fixture deterministically hard-invalids.

### Task 3 — Dual-threshold no-trigger rule (ratio + absolute floor)
- **Scope:** starvation decision gate.
- **Change:** require both ratio and absolute defer-count conditions before suppressing starvation trigger.
- **Trigger:** `hard-invalid:fairness-denominator-distortion-risk`.
- **Acceptance criteria:** high-ratio but low-absolute fixture no longer suppresses correctly; distortion fixture hard-invalids.

## Chosen next task
**Implement Task 1 first: active-key contribution floor + dust-key exclusion trigger.**

## Why this first
- smallest patch surface,
- directly blocks easiest denominator manipulation path,
- provides cleaner active-key baseline for subsequent window and dual-threshold controls.

## Merge gate
- deterministic non-dust vs dust-inflation fixtures,
- typecheck + targeted tests pass,
- markdown/json surfaces preserve trigger visibility + governed parity behavior.
