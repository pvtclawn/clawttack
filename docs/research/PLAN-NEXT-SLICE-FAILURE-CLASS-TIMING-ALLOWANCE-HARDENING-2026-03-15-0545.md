# Plan — next smallest mergeable slice for failure-class timing-allowance hardening (2026-03-15 05:45 UTC)

## Context
Latest challenge identified spoofing paths in the timing-window allowance model:
1. failure-class self-label spoofing,
2. retry-signal fabrication,
3. permissive handling of unknown delivery semantics,
4. allowance stacking drift.

Goal: choose the smallest high-leverage implementation slice with deterministic fixture coverage.

## Candidate tasks

### Task 1 — Derived failure-class parity check (smallest)
- **Scope:** summary classification path.
- **Change:** derive failure class from existing log/error taxonomy and compare against reported failure class (if present).
- **Trigger:** `hard-invalid:failure-class-derivation-mismatch`.
- **Acceptance criteria:**
  1. matching derived/reported class does not trigger,
  2. mismatched class triggers hard-invalid deterministically,
  3. top claim-limiting reason uses mismatch trigger when higher-priority hard-invalids absent.

### Task 2 — Retry-evidence verification gate
- **Scope:** allowance eligibility path.
- **Change:** require verifiable retry-evidence tuple (same-turn linkage, monotonic attempt counter, bounded timing).
- **Trigger:** `hard-invalid:retry-evidence-unverifiable`.
- **Acceptance criteria:** fabricated marker-only fixture fails eligibility + triggers hard-invalid.

### Task 3 — Non-stackable global cap enforcement
- **Scope:** effective window computation.
- **Change:** enforce `effectiveWindow <= modeBaseWindow * 1.20` regardless of combined justifications.
- **Trigger:** `hard-invalid:timing-allowance-cap-exceeded`.
- **Acceptance criteria:** stacked-allowance fixture hard-invalids deterministically.

## Chosen next task
**Implement Task 1 first: derived failure-class parity check + mismatch hard-invalid trigger.**

## Why this first
- smallest patch surface,
- directly blocks the easiest label-spoof path,
- creates a trustworthy base signal for subsequent allowance logic.

## Merge gate
- deterministic match/mismatch fixtures,
- typecheck + targeted tests pass,
- markdown/json surfaces retain trigger visibility and parity behavior.
