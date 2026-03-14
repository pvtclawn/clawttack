# REDTEAM — V05 Task 3 Comparable Gate

Date: 2026-03-14 13:55 UTC  
Scope: `packages/sdk/scripts/summarize-v05-batches.py` comparison output (`comparable`, `comparabilityReasons[]`)

## Threat model
Task 3 should prevent invalid baseline/intervention comparisons from being treated as evaluative evidence.

## Key failure modes
1. **Partial-gate false positives**
   - Comparable can be incorrectly true if fingerprint parity is checked but strict/guardrail failures are ignored.
2. **Hidden config drift misclassification**
   - Run-config drift outside declared intervention variable may go uncaught and still look comparable.
3. **Missing-baseline ambiguity**
   - First run (or missing previous artifact) can be silently treated as comparable if not explicitly reason-coded.
4. **Non-deterministic reason ordering**
   - Instability in reason ordering undermines machine-diff reliability and strict checks.
5. **Markdown evaluative leakage**
   - Human-readable output may still include comparative language while `comparable=false`.

## Required guardrails
- Comparable truth condition must be conjunctive:
  - previous fingerprint exists,
  - strict diagnostics are clean,
  - guardrail contract is clean,
  - drift is limited to declared intervention variable.
- `comparabilityReasons[]` must be deterministic and include all applicable classes.
- Include explicit classes:
  - `missing-baseline`
  - `strict-violation`
  - `guardrail-failure`
  - `runconfig-drift-outside-allowed-variable`
- Markdown must use non-evaluative wording when non-comparable.

## Outcome
Task 3 should proceed, but only with deterministic reason classes and fail-closed comparability semantics.

## Caveat
This is a challenge artifact only; no runtime code changes are made in this lane.