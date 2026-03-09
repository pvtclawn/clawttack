# 028 — Context Growth Budget Gate Plan (2026-03-09)

Input: `memory/reading-notes/2026-03-09--context-growth-budget-gates-from-clawdrain-findings.md`

## Motivation
Guardrail loops can be correct yet still economically unsafe if context growth is unbounded. Clawdrain-style findings show prompt-surface bloat + persistent tool outputs can create stealthy token amplification even when tasks eventually “succeed.”

## Proposed delta (simulation-only)
Introduce a context growth budget gate across loop-driven guardrails.

### Per-iteration tracked signals
1. `promptDeltaEstimate`
2. `toolTraceDeltaEstimate`
3. `cumulativeContextRatio` (used / budget)
4. `visibilityMode` (raw-trace vs narrated) for risk annotation

### Deterministic policy
- if ratio >= `softThreshold`: emit `context-growth-warning`
- if ratio >= `hardThreshold`: halt with `context-budget-exceeded`

## Candidate integration points
- `iterative-goal-verification`
- `failure-injection-matrix` rerun loops
- `replay-envelope` resync flows

## Acceptance criteria
1. Normal convergence fixtures remain below hard threshold.
2. Amplification fixtures trigger deterministic `context-budget-exceeded` halts.
3. Warning/halt reason timeline is replay-stable across identical runs.
4. No fixture can continue indefinitely after hard threshold breach.

## Minimal next task
Implement a pure TypeScript context-budget helper + fixtures for:
- normal convergence,
- recoverable warning,
- adversarial amplification hard-stop,
with deterministic reason-code outputs and no production runtime changes in the same PR.
