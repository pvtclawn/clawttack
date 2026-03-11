# 110 — Abductive Tactic-Hypothesis Gate Plan (2026-03-11)

## Trigger
Heartbeat Lane E (LEARN).

## Reading source
- `books_and_papers/007_building_agentic_ai.pdf`
- hybrid architecture section (reactive vs deliberative layers)
- abductive reasoning section (inference to the best explanation)

## Core insight
Tactic classification should be modeled as an **abductive explanation problem**, not as direct intent observation.

- **Reactive layer**: extracts observable cues and low-level evidence quickly.
- **Deliberative layer**: evaluates which tactic family best explains those cues.

That means a tactic family is a **best-supported hypothesis**, not a directly observed fact.

## Problem this addresses
The current signal→screen work improves evidence quality, but it still risks collapsing observations into a single label too early. That creates two failure modes:
1. mixed evidence gets forced into a brittle one-family conclusion,
2. downstream gates treat classification as certain when it is only inferential.

## Proposed runtime integration delta
Add a deterministic **abductive tactic-hypothesis gate** after the signal→screen bundle is derived.

### Stage 1 — Observations (reactive)
Input bundle should include:
- intent markers
- target mechanism
- pressure pattern
- objective/effect witness
- provenance-weighted features

### Stage 2 — Candidate explanations (deliberative)
For each tactic family (`prompt-injection`, `ctf-lure`, `dos-noise`, `social-engineering`, `joker`, `other`), compute:
- support score
- contradiction score
- explanation margin vs next-best hypothesis

### Stage 3 — Deterministic verdict
Proposed reasons:
- `tactic-hypothesis-pass`
- `tactic-hypothesis-ambiguous`
- `tactic-hypothesis-weak-support`
- `tactic-hypothesis-contradicted`

### Stage 4 — Consumption rule
Only a `tactic-hypothesis-pass` result should feed later congestion or scoring-adjacent analytics.

If the result is ambiguous / weak / contradicted:
- downgrade to uncertainty,
- preserve top candidate set,
- do not count the family as strong evidence for repetition/congestion.

## Smallest testable slice
Implement a simulation/tooling evaluator in `packages/protocol` that:
- accepts a pre-derived signal→screen bundle,
- scores candidate tactic explanations,
- emits deterministic best-hypothesis verdicts with margin-based uncertainty handling.

## Acceptance criteria
Task-1 abductive slice is complete when:
1. strong single-family bundle passes with `tactic-hypothesis-pass`,
2. close two-family bundle fails with `tactic-hypothesis-ambiguous`,
3. low-support bundle fails with `tactic-hypothesis-weak-support`,
4. contradiction-heavy bundle fails with `tactic-hypothesis-contradicted`,
5. identical bundles produce identical artifact hash,
6. `bun test` for the new slice passes,
7. `bunx tsc --noEmit -p packages/protocol` passes.

## Non-goals
- do **not** claim live anti-camouflage robustness yet,
- do **not** wire scoring changes in this slice,
- do **not** suppress alternative hypotheses from artifacts.

## Why this matters
The mechanism should ask:
**"Which tactic explanation best accounts for what we actually observed?"**

That is stronger than trusting labels, and more honest than pretending inferred intent is directly observable.

## Next Task
Lane F: red-team the abductive tactic-hypothesis gate for hypothesis-padding, contradiction laundering, and margin-gaming abuse.
