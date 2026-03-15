# Plan — next smallest hardened completionEvidence slice (2026-03-15 11:37 UTC)

## Context
Recent lanes established:
1. current agent-vs-agent live evidence proves multi-turn activity but not end-to-end completion,
2. acceptance/settlement are currently inferred from runner log tokens,
3. a naive boolean `completionEvidence` block would improve visibility but still risks overclaiming from partial or stale observations.

Goal: choose the smallest build slice that improves end-state diagnosis **without** pretending partial observation equals a proper battle.

## Candidate tasks

### Task 1 — Hardened completionEvidence schema (smallest)
**Scope:** runner/summarizer artifact schema only.

**Change:** replace the naive boolean milestone shape with a hardened structure:
- per milestone (`created`, `accepted`, `multiTurnReached`, `terminalObserved`):
  - `status`: `observed | absent | indeterminate`
  - `observationMethod`
  - `observationAuthority`
- add `terminalKind`
- keep `properBattleSatisfied` separate from `terminalObserved`
- derive `divergenceBoundary` from per-milestone evidence instead of using it as the only forensic field

**Acceptance criteria:**
1. one deterministic fixture can represent a pure observability gap (`terminalObserved.chain=observed`, log-path absent/indeterminate) without upgrading `properBattleSatisfied`,
2. one deterministic fixture can represent a true settlement gap (`terminalObserved=absent` across sources),
3. summaries/reporting phrase log-vs-chain mismatch as an observability gap, not mixed authority,
4. no field shape implies runner logs and on-chain state have equal evidentiary weight.

### Task 2 — On-chain terminal confirmation rule
**Scope:** terminal-state confidence only.

**Change:** require either:
- receipt/log anchor, or
- two consecutive matching terminal reads,
before `terminalObserved.status=observed` can become authoritative.

**Why not first:** useful, but larger than the minimal schema hardening step.

### Task 3 — Proper-battle rubric integration
**Scope:** verdict logic.

**Change:** teach proper-battle evaluation to consume hardened `completionEvidence` directly.

**Why not first:** higher leverage later, but it is downstream of getting the evidence shape right.

## Chosen next task
**Implement Task 1 first: hardened completionEvidence schema.**

## Why this first
- smallest mergeable slice,
- directly incorporates the red-team critique,
- reduces false confidence before any live rerun,
- creates the right scaffold for later confirmation rules and rubric integration.

## Next Task
Patch the runner/summarizer artifact path to emit a hardened `completionEvidence` structure with tri-state milestone status, authority ordering, and `terminalKind` / `properBattleSatisfied` separation, plus deterministic fixture coverage for observability-gap vs true-settlement-gap cases.
