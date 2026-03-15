# Plan — next smallest mergeable timing-aware evidence hardening slice (2026-03-15 05:15 UTC)

## Context
Latest red-team output identified three implementation-ready timing-hardening controls:
1. profile-locked freshness-window binding,
2. run-fingerprint timing-model binding,
3. evidence-inventory closure check.

Goal: choose the smallest high-leverage slice that blocks obvious gaming with minimal code churn.

## Candidate tasks

### Task 1 — Freshness-window profile binding (smallest)
- **Scope:** classification/evidence-evaluation path only.
- **Change:** derive `evidenceFreshnessWindowMs` from profile/rule config; reject producer-supplied override drift.
- **Trigger:** `hard-invalid:timing-window-profile-mismatch`.
- **Acceptance criteria:**
  1. fixture with matching profile window passes,
  2. fixture with inflated/altered window hard-invalids,
  3. trigger text surfaced in top claim-limiting reason when it is highest-priority invalid.

### Task 2 — Timing-model fingerprint binding
- **Scope:** run-config fingerprint + evidence timing-model assignment.
- **Change:** enforce `evidenceTimingModel` derived from run fingerprint mapping; no free-form label override.
- **Trigger:** `hard-invalid:timing-model-mismatch`.
- **Acceptance criteria:** model-label mismatch fixture hard-invalids deterministically.

### Task 3 — Evidence-inventory closure
- **Scope:** evidence-source aggregation/validation layer.
- **Change:** require declared tier breakdown to cover all observed eligible sources.
- **Trigger:** `hard-invalid:evidence-inventory-incomplete`.
- **Acceptance criteria:** omitted-source fixture hard-invalids with explicit missing-source count.

## Chosen next task
**Implement Task 1 first: freshness-window profile binding + mismatch trigger.**

## Why this first
- smallest patch surface,
- directly blocks easiest exploit (window inflation),
- establishes a deterministic timing baseline for Tasks 2 and 3.

## Merge gate
- deterministic fixture pass/fail coverage for window match vs mismatch,
- typecheck clean,
- markdown/json artifact visibility for mismatch trigger retained.
