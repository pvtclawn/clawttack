# Plan — next smallest mergeable fail-safe compaction abuse hardening slice (2026-03-15 09:15 UTC)

## Context
Latest challenge identified fail-safe compaction abuse vectors:
1. perpetual defer-budget exhaustion,
2. selective-defer hot-key starvation,
3. backpressure metric-integrity suppression,
4. stale defer-snapshot reuse.

Goal: pick one smallest high-leverage implementation slice with deterministic acceptance criteria.

## Candidate tasks

### Task 1 — Defer-budget cap + deterministic escalation trigger (smallest)
- **Scope:** fail-safe compaction control path only.
- **Change:** add bounded `transitionLedgerCompactionDeferredCount` threshold and fail-closed trigger when exceeded.
- **Trigger:** `hard-invalid:compaction-failsafe-defer-budget-exhausted`.
- **Acceptance criteria:**
  1. fixture below defer threshold => no exhaust trigger,
  2. fixture above defer threshold => deterministic hard-invalid,
  3. top claim-limiting reason uses defer-budget trigger when no higher-priority invalid exists.

### Task 2 — Selective-defer fairness guard
- **Scope:** per-key compaction deferral accounting.
- **Change:** track per-key defer counts and detect disproportionate starvation patterns.
- **Trigger:** `hard-invalid:compaction-failsafe-selective-defer-abuse`.
- **Acceptance criteria:** hot-key starvation fixture hard-invalids deterministically.

### Task 3 — Backpressure metric-integrity checks
- **Scope:** compaction telemetry consistency validation.
- **Change:** enforce monotonic deferred counters + cross-field consistency digest.
- **Trigger:** `hard-invalid:compaction-backpressure-metric-integrity-failure`.
- **Acceptance criteria:** tampered/underreported defer metrics fixture hard-invalids.

## Chosen next task
**Implement Task 1 first: defer-budget cap + `hard-invalid:compaction-failsafe-defer-budget-exhausted`.**

## Why this first
- smallest patch surface,
- directly constrains denial-of-progression risk,
- provides baseline control before fairness and telemetry-integrity extensions.

## Merge gate
- deterministic below/above-threshold fixtures,
- typecheck + targeted tests pass,
- markdown/json surfaces preserve trigger visibility + governed parity behavior.
