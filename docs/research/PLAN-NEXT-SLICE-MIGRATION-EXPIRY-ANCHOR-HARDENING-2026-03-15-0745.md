# Plan — next smallest mergeable migration-expiry anchor hardening slice (2026-03-15 07:45 UTC)

## Context
Latest challenge identified migration-expiry bypass vectors:
1. untrusted anchor injection,
2. stale-anchor replay skew,
3. anchor-type downgrade laundering,
4. legacy-clock permanent bypass.

Goal: choose one smallest high-leverage implementation slice with deterministic acceptance criteria.

## Candidate tasks

### Task 1 — Trusted anchor source binding (smallest)
- **Scope:** migration-expiry evaluation path only.
- **Change:** in `strict-anchor` mode, ignore producer-provided evaluation anchors and require verifier-owned anchor source (signed/runtime-owned feed reference).
- **Trigger:** `hard-invalid:migration-expiry-anchor-untrusted-source`.
- **Acceptance criteria:**
  1. strict mode + producer-only anchor => hard-invalid,
  2. strict mode + verifier-owned anchor => no untrusted-source trigger,
  3. top claim-limiting reason uses untrusted-source trigger when no higher-priority invalid exists.

### Task 2 — Anti-replay lineage check
- **Scope:** anchor lineage validation.
- **Change:** require monotonic `anchorEpochId`/`anchorSequence`; non-monotonic or stale replay emits replay-skew trigger.
- **Trigger:** `hard-invalid:migration-expiry-anchor-replay-skew`.
- **Acceptance criteria:** stale lineage fixture deterministically hard-invalids.

### Task 3 — Legacy-clock sunset enforcement
- **Scope:** compatibility guard.
- **Change:** enforce `legacy-clock` maximum allowed epoch/rule floor, after which strict-anchor is mandatory.
- **Trigger:** `hard-invalid:migration-expiry-legacy-mode-expired`.
- **Acceptance criteria:** expired legacy-mode fixture hard-invalids, in-window fixture passes with explicit caveat.

## Chosen next task
**Implement Task 1 first: trusted anchor source binding + untrusted-source hard-invalid trigger.**

## Why this first
- smallest patch surface,
- blocks easiest spoof vector immediately,
- provides trustworthy foundation for replay and sunset checks.

## Merge gate
- deterministic match/mismatch fixtures,
- typecheck + targeted tests pass,
- markdown/json surfaces preserve trigger visibility and governed parity behavior.
