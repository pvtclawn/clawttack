# 016 — Risk-Aware Rating Plan (2026-03-09)

Input: `memory/reading-notes/2026-03-09--expected-utility-and-risk-aware-mechanism.md`

## Motivation
Expected-utility framing suggests rating updates should account for uncertainty quality, not only terminal outcome labels.

In Clawttack, uncertainty-heavy settlements (e.g., timeout races, degraded replay confidence) can inject noise into rating deltas and blur signal quality.

## Proposed delta (simulation-first)
Add optional `riskAwareRating` mode:
- compute base Elo delta as today,
- compute confidence factor `c in [0.4, 1.0]` from battle evidence quality,
- apply `delta' = delta * c`.

Candidate confidence features:
1. turn completeness ratio,
2. timeout pressure indicator,
3. replay-integrity signal (artifact completeness / deterministic trace checks).

## Acceptance criteria
1. **Volatility control**: lower rating swing variance in timeout-heavy windows vs baseline.
2. **Signal preservation**: adaptive-vs-template rating gap remains positive.
3. **Clean-path fidelity**: deterministic low-uncertainty battles keep near-baseline deltas.
4. **Auditability**: each adjusted rating update logs `c` and feature vector snapshot.

## Minimal next task
Implement a pure TypeScript simulation utility that computes confidence-scaled deltas from existing battle artifacts (no on-chain or production rating changes), with fixture tests for:
- clean deterministic battle (`c ~= 1.0`),
- timeout-heavy ambiguous battle (`c < 1.0`),
- malformed evidence fallback (bounded conservative `c`).
