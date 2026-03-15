# Plan — next smallest mergeable timeout-subtype allowance hardening slice (2026-03-15 06:15 UTC)

## Context
Latest challenge identified three implementation-ready controls for timeout-subtype allowance safety:
1. aggregate allowance cap across subtype partitions,
2. ambiguity detector with strict fallback subtype,
3. rolling hotspot hysteresis.

Goal: pick the smallest high-leverage slice with deterministic fixture coverage and low coupling.

## Candidate tasks

### Task 1 — Aggregate allowance cap (smallest / highest leverage)
- **Scope:** allowance accounting layer only.
- **Change:** add global cap across subtype partitions to prevent budget-fragmentation bypass even when each subtype remains below its own cap.
- **Trigger:** `hard-invalid:timeout-allowance-aggregate-exceeded`.
- **Acceptance criteria:**
  1. fixture with churned subtype usage that keeps each per-subtype budget below cap but exceeds aggregate cap must hard-invalid,
  2. fixture below aggregate cap must not emit aggregate trigger,
  3. top claim-limiting reason uses aggregate trigger when no higher-priority trigger exists.

### Task 2 — Subtype ambiguity detector + strict fallback
- **Scope:** timeout subtype classifier.
- **Change:** detect overlapping/ambiguous token matches; classify to strict fallback subtype and emit ambiguity signal when repeated.
- **Trigger:** `hard-invalid:timeout-subtype-ambiguity`.
- **Acceptance criteria:** ambiguous token fixture deterministically enters strict fallback path and increments ambiguity counter.

### Task 3 — Rolling hotspot hysteresis
- **Scope:** hotspot evaluation logic.
- **Change:** replace single-threshold check with rolling-window hysteresis to prevent threshold-oscillation evasion.
- **Trigger:** `hard-invalid:timeout-hotspot-oscillation`.
- **Acceptance criteria:** oscillation fixture triggers hotspot-oscillation deterministically; stable balanced fixture does not.

## Chosen next task
**Implement Task 1 first: aggregate allowance cap + hard-invalid trigger.**

## Why this first
- smallest patch surface and easiest deterministic fixture design,
- directly blocks the most scalable bypass (synthetic subtype churn),
- creates baseline safety net before refining classifier ambiguity/hysteresis behavior.

## Merge gate
- deterministic pass/fail fixtures for aggregate-cap logic,
- typecheck + targeted tests pass,
- markdown/json surfaces preserve trigger visibility and governed parity.
