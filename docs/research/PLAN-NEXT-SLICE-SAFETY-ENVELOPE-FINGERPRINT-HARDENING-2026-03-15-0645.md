# Plan — next smallest mergeable safety-envelope fingerprint hardening slice (2026-03-15 06:45 UTC)

## Context
Challenge output identified spoof/replay/drift risks in timeout-cap safety-envelope fingerprints:
1. version/hash replay,
2. evidence-closure omission,
3. canonicalization drift,
4. mode-profile lineage mismatch.

Goal: choose the smallest high-leverage implementation slice with deterministic fixture coverage.

## Candidate tasks

### Task 1 — Rule-version/hash binding in fingerprint preimage (smallest)
- **Scope:** fingerprint generation + validation only.
- **Change:** include `ruleVersion` + `ruleHash` + `modeProfileHash` in determinism preimage.
- **Trigger:** `hard-invalid:safety-envelope-fingerprint-version-mismatch`.
- **Acceptance criteria:**
  1. same evidence + different ruleVersion/hash => mismatch trigger,
  2. same evidence + same version/hash => no mismatch,
  3. top claim-limiting reason uses mismatch trigger when no higher-priority invalid exists.

### Task 2 — Evidence-closure manifest hashing
- **Scope:** evidence tuple assembly.
- **Change:** add explicit closure manifest + manifest hash in preimage.
- **Trigger:** `hard-invalid:safety-envelope-evidence-closure-incomplete`.
- **Acceptance criteria:** missing required evidence key in manifest deterministically triggers invalid.

### Task 3 — Canonicalization drift detector
- **Scope:** encoding layer.
- **Change:** enforce strict canonical serialization contract and detect drift.
- **Trigger:** `hard-invalid:safety-envelope-canonicalization-drift`.
- **Acceptance criteria:** semantically identical tuples with different raw ordering yield identical canonical hash; non-canonical inputs produce drift trigger.

## Chosen next task
**Implement Task 1 first: rule-version/hash preimage binding + mismatch hard-invalid trigger.**

## Why this first
- smallest patch surface,
- blocks the easiest replay vector immediately,
- provides deterministic base for later closure/canonicalization hardening.

## Merge gate
- deterministic match/mismatch fixtures,
- typecheck + targeted tests pass,
- markdown/json surfaces retain trigger visibility/parity behavior.
