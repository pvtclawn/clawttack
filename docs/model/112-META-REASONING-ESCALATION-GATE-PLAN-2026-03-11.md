# 112 — Meta-Reasoning Escalation Gate Plan (2026-03-11)

## Trigger
Heartbeat Lane E (LEARN).

## Reading source
- `books_and_papers/007_building_agentic_ai.pdf`
- reflection / meta-reasoning / performance-monitoring sections

## Core insight
Reflection only becomes operational when the system has:
- diagnostic metrics,
- thresholds for when those metrics are unacceptable,
- and an escalation policy that changes reasoning effort or verdict behavior.

For Clawttack, tactic inference already produces the right kinds of diagnostics:
- ambiguity,
- contradiction,
- weak support,
- alternative-density,
- proof-missing / mixed-signal outcomes.

What is missing is a deterministic controller that decides what to do when those diagnostics cross thresholds.

## Problem this addresses
Current slices can say:
- "this looks ambiguous,"
- "this looks contradicted,"
- "this looks weakly supported."

But they do not yet say:
- when should the runtime trust the cheap path,
- when should it escalate to deeper verification,
- when should it fail closed instead of forcing a tactic label.

Without this layer, the system merely records uncertainty instead of adapting its reasoning strategy.

## Proposed runtime integration delta
Add a deterministic **meta-reasoning escalation gate** after tactic signal→screen and abductive hypothesis scoring.

### Inputs
The gate should consume diagnostic outputs from earlier slices, including:
- screen verdict
- hypothesis verdict
- contradiction score
- explanation margin
- alternative-density
- ambiguity debt / sparsity debt (future slices)
- derivation-version compatibility status (future slices)

### Deterministic actions
Proposed outcomes:
- `tactic-escalation-accept-cheap-path`
- `tactic-escalation-request-deeper-verification`
- `tactic-escalation-fail-closed`

### Policy shape
- If evidence is clean and margins are healthy => accept cheap path.
- If evidence is mixed but not catastrophically contradicted => request deeper verification.
- If contradiction, derivation mismatch, or repeated uncertainty debt crosses threshold => fail closed.

### Deeper verification examples
Future deeper-verification hooks could include:
- richer feature extraction,
- stronger contradiction checks,
- expanded explanation trace review,
- human/audit-mode artifact preservation.

## Smallest testable slice
Implement a simulation/tooling evaluator in `packages/protocol` that:
- accepts a compact diagnostic summary,
- applies deterministic threshold rules,
- emits one of the three escalation outcomes with stable artifact hash.

## Acceptance criteria
Task-1 escalation slice is complete when:
1. clean diagnostic bundle passes with `tactic-escalation-accept-cheap-path`,
2. mixed-but-salvageable bundle yields `tactic-escalation-request-deeper-verification`,
3. contradiction/debt/version-risk bundle yields `tactic-escalation-fail-closed`,
4. identical bundles produce identical artifact hash,
5. `bun test` for the new slice passes,
6. `bunx tsc --noEmit -p packages/protocol` passes.

## Non-goals
- do **not** wire live deeper-verification implementations in this slice,
- do **not** claim runtime anti-gaming is solved,
- do **not** silently overwrite earlier artifact outputs.

## Why this matters
The key question is not only **"what tactic best explains the evidence?"**
It is also **"is the evidence good enough to trust the cheap path, or should the system escalate scrutiny?"**

That is the missing control layer between mere diagnostics and robust runtime behavior.

## Next Task
Lane F: red-team the meta-reasoning escalation gate for escalation farming, fail-closed griefing, and threshold-manipulation abuse.
