# Plan — Next smallest mergeable hardening slice (2026-03-15 04:15 UTC)

## Context
Current red-team output identified three claim-integrity risks:
1. hidden helper/script fallback masked as `agent` provenance,
2. fluent-but-vacuous transcript passing shallow quality checks,
3. non-credit verdict spin outside governed block.

Goal: choose the **smallest mergeable slice** that raises fail-closed reliability without broad refactor.

## Candidate tasks (ordered)

### Task 1 — Provenance mismatch hard-invalid (smallest, highest leverage)
- **Scope:** classification path only (no runtime transport redesign).
- **Change:** add deterministic `provenanceMismatch` rule to hard-invalid triggers when declared mode/source conflicts with observed move-source metadata.
- **Acceptance criteria:**
  - synthetic fixture with source conflict deterministically sets:
    - `invalidForProperBattle=true`
    - `forcedVerdictTier=invalid-for-proper-battle`
    - `hardInvalidTriggers` includes `provenanceMismatch`
  - markdown and json outputs both surface this trigger.

### Task 2 — Coherence guard threshold (bounded)
- **Scope:** artifact scoring/check layer.
- **Change:** add 3 binary guards (`stateReferenceContinuity`, `opponentResponseLinkage`, `novelActionPressure`) and downgrade if <2 pass.
- **Acceptance criteria:**
  - fixture with 1/3 pass gets non-credit tier + explicit reason;
  - fixture with 2/3 pass remains eligible (subject to other rules).

### Task 3 — Non-credit spin linter (cross-surface)
- **Scope:** markdown generation/lint step.
- **Change:** if tier is non-credit, require downgraded label + adjacent caveat in headline/first-summary sentence; reject prestige wording.
- **Acceptance criteria:**
  - failing sample triggers deterministic lint failure;
  - compliant sample passes with unchanged raw tier.

## Chosen next task (single)
**Implement Task 1: `provenanceMismatch` hard-invalid trigger with markdown/json parity checks.**

Why this one first:
- smallest patch surface,
- directly protects `agent-vs-*` authenticity claims,
- creates clean foundation for subsequent coherence and spin controls.

## Merge gate for this slice
- compile/typecheck clean,
- deterministic fixture(s) proving trigger behavior,
- artifact parity confirmed (json + markdown),
- no wording-only claim changes without structured trigger evidence.
