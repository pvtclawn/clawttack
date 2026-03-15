# Plan — next smallest mergeable tombstone-compaction replay hardening slice (2026-03-15 08:45 UTC)

## Context
Latest challenge on anti-replay tombstone compaction identified major bypass vectors:
1. replay-guard hash elision,
2. premature retention/eviction,
3. non-atomic compaction swap race,
4. weak replay-guard preimage collision risk.

Goal: choose one smallest high-leverage implementation slice with deterministic acceptance criteria.

## Candidate tasks

### Task 1 — Mandatory replay-guard hash invariant (smallest)
- **Scope:** compacted-tombstone validation only.
- **Change:** enforce that any `transitionLedgerState=compacted-tombstone` must include non-empty `transitionLedgerReplayGuardHash`.
- **Trigger:** `hard-invalid:transition-ledger-compaction-replay-guard-missing`.
- **Acceptance criteria:**
  1. compacted tombstone with replay-guard hash => no missing-guard trigger,
  2. compacted tombstone without replay-guard hash => deterministic hard-invalid,
  3. top claim-limiting reason uses missing-guard trigger when no higher-priority invalid exists.

### Task 2 — Transactional swap enforcement
- **Scope:** compaction state transition semantics.
- **Change:** require atomic consumed→compacted replacement marker in artifact metadata; absence indicates non-atomic compaction path.
- **Trigger:** `hard-invalid:transition-ledger-compaction-atomicity-breach`.
- **Acceptance criteria:** non-atomic transition fixture hard-invalids deterministically.

### Task 3 — Retention-floor guard
- **Scope:** retention policy check.
- **Change:** enforce minimum retention horizon per rule/profile before tombstone eviction.
- **Trigger:** `hard-invalid:transition-ledger-retention-underflow`.
- **Acceptance criteria:** below-floor horizon fixture hard-invalids; at/above floor passes.

## Chosen next task
**Implement Task 1 first: mandatory replay-guard hash invariant + missing-guard hard-invalid trigger.**

## Why this first
- smallest patch surface,
- blocks the simplest key-resurrection path immediately,
- prerequisite trust anchor for transactional swap and retention-floor logic.

## Merge gate
- deterministic match/mismatch fixtures,
- typecheck + targeted tests pass,
- markdown/json surfaces preserve trigger visibility and governed parity behavior.
