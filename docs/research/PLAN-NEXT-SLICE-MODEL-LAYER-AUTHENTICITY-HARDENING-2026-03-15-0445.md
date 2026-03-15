# Plan — next smallest mergeable slice for model-layer authenticity hardening (2026-03-15 04:45 UTC)

## Context
Red-team output (04:40 UTC) identified three build-ready mitigations:
1. evidence-source diversity gate,
2. global/local consistency hard-invalid invariant,
3. causal-chain reference+hash binding validator.

Goal now: pick the smallest high-leverage slice that materially reduces cosmetic pass risk while keeping patch scope tight.

## Candidate tasks

### Task 1 — Evidence-source diversity gate (smallest)
- **Scope:** classification/model-evaluation layer only.
- **Change:** add deterministic `evidenceSourceDiversity` metric and gate:
  - `completenessSatisfied=true` only if required provenance fields exist **and** diversity >= 2 with at least one source outside move-producer path.
  - otherwise `completenessSatisfied=false` and `failsClosed=true`.
- **Acceptance criteria:**
  1. single-source fixture with full keys fails completeness and fail-closes,
  2. two-source fixture (producer + independent checkpoint/log derivation) passes completeness,
  3. output surfaces include explicit `evidenceSourceCount` and `independentSourcePresent` booleans.

### Task 2 — Global/local consistency invariant
- **Scope:** verdict reducer + hard-invalid trigger path.
- **Change:** enforce that global verdict is deterministic function of local evidence + rule hash; mismatch emits `hard-invalid:global-local-inconsistency`.
- **Acceptance criteria:** contradiction fixture hard-invalids and forces invalid tier.

### Task 3 — Causal-chain ref/hash binding validator
- **Scope:** reasoning-chain schema + validation.
- **Change:** require `(sourceRef, ruleRef, outputRef)` per step and final-link hash parity with top claim-limiting reason.
- **Acceptance criteria:** missing refs/hash mismatch fail-close deterministically.

## Chosen next task
**Implement Task 1 first: evidence-source diversity gate.**

## Why this first
- smallest code footprint and lowest coupling,
- directly blocks the easiest cosmetic pass attack (single-source self-attestation),
- provides clean prerequisite signal for Task 2 and Task 3.

## Merge gate for this slice
- targeted fixture tests for pass/fail diversity cases,
- typecheck clean,
- no change to external claims language without structured field evidence.
