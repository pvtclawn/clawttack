# Plan — next smallest mergeable bounded epoch-transition anti-replay hardening slice (2026-03-15 08:15 UTC)

## Context
Latest challenge on bounded epoch-transition windows identified key bypass vectors:
1. carryover-digest scope forgery,
2. transition-id replay across contexts,
3. window-edge oscillation + cumulative displacement laundering.

Goal: pick one smallest high-leverage implementation slice with deterministic acceptance criteria.

## Candidate tasks

### Task 1 — Carryover-scope hash binding (smallest)
- **Scope:** transition validation path only.
- **Change:** require `anchorTransitionCarryoverDigest` to be computed over full required lineage manifest hash + `(ruleVersion, modeProfileHash, fromEpoch, toEpoch)`.
- **Trigger:** `hard-invalid:anchor-transition-carryover-scope-mismatch`.
- **Acceptance criteria:**
  1. matching full-scope digest fixture => no carryover-scope trigger,
  2. truncated/partial-scope digest fixture => deterministic hard-invalid,
  3. top claim-limiting reason uses carryover-scope trigger when no higher-priority invalid exists.

### Task 2 — Transition-id anti-replay ledger
- **Scope:** transition-id validation + stateful uniqueness check.
- **Change:** enforce one-time `anchorEpochTransitionId` usage scoped by `(ruleVersion, modeProfileHash, fromEpoch, toEpoch)`.
- **Trigger:** `hard-invalid:anchor-transition-id-replay`.
- **Acceptance criteria:** replayed transition-id fixture deterministically hard-invalids.

### Task 3 — Aggregate displacement guard
- **Scope:** rolling transition horizon evaluation.
- **Change:** cap cumulative sequence/epoch displacement across chained transitions.
- **Trigger:** `hard-invalid:anchor-transition-aggregate-displacement-exceeded`.
- **Acceptance criteria:** chained micro-transition fixture exceeds horizon cap and hard-invalids.

## Chosen next task
**Implement Task 1 first: carryover-scope hash binding + mismatch hard-invalid trigger.**

## Why this first
- smallest patch surface,
- directly blocks the easiest digest-forgery vector,
- prerequisite quality signal for transition-id replay and cumulative displacement controls.

## Merge gate
- deterministic match/mismatch fixtures,
- typecheck + targeted tests pass,
- markdown/json surfaces preserve trigger visibility + governed parity behavior.
