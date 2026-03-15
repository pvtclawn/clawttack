# Plan — next smallest mergeable strict-core closure hashing hardening slice (2026-03-15 07:15 UTC)

## Context
Latest challenge identified strict-core abuse vectors:
1. required-core key downgrades,
2. optional drift masking,
3. stale schema-version pinning,
4. cross-mode core-set laundering.

Goal: choose one smallest high-leverage implementation slice with deterministic acceptance criteria.

## Candidate tasks

### Task 1 — Key-classification policy hash binding (smallest)
- **Scope:** closure-manifest metadata + validation path.
- **Change:** attach `closureKeyClassificationPolicyHash` (derived from required/optional partition policy) to manifest and bind it in safety-envelope validation.
- **Trigger:** `hard-invalid:closure-key-classification-downgrade` when reported hash does not match expected policy hash for current ruleVersion.
- **Acceptance criteria:**
  1. matching policy hash fixture => no trigger,
  2. downgraded required->optional policy hash fixture => deterministic hard-invalid,
  3. top claim-limiting reason uses downgrade trigger when no higher-priority invalid exists.

### Task 2 — Mode-bound core-set hash check
- **Scope:** mode profile + closure manifest consistency check.
- **Change:** require `requiredCoreSetHash` to match mode profile mapping (`script-vs-script`, `agent-vs-script`, `agent-vs-agent`).
- **Trigger:** `hard-invalid:closure-core-mode-binding-mismatch`.
- **Acceptance criteria:** cross-mode hash reuse fixture deterministically hard-invalids.

### Task 3 — Schema-version freshness floor
- **Scope:** schema compatibility guard.
- **Change:** enforce minimum `closureSchemaVersion` per `ruleVersion`.
- **Trigger:** `hard-invalid:closure-schema-version-stale`.
- **Acceptance criteria:** stale pinned schema fixture hard-invalids; current schema fixture passes.

## Chosen next task
**Implement Task 1 first: key-classification policy hash binding + downgrade trigger.**

## Why this first
- smallest patch surface,
- directly blocks highest-risk partition-manipulation vector,
- prerequisite signal quality for mode-binding and schema-freshness checks.

## Merge gate
- deterministic match/mismatch fixtures,
- typecheck + targeted tests pass,
- markdown/json surfaces preserve trigger visibility and governed parity behavior.
