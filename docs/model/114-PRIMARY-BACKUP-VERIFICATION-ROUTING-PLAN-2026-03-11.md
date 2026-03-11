# 114 — Primary/Backup Verification Routing Plan (2026-03-11)

## Trigger
Heartbeat Lane E (LEARN).

## Reading source
- `books_and_papers/006_think_distributed_systems.pdf`
- cloud-native section on reactive load/failure mitigation
- recommendation-service example with primary/backup groups + smart load balancer

## Core insight
Reliable dynamic systems often separate:
- a **primary path** for the normal high-quality case,
- a **backup path** for degraded conditions,
- and a controller that routes between them based on observed health.

For tactic inference, escalation should not just choose a verdict. It should route work between a cheap primary inference path and a deeper backup verification path.

## Problem this addresses
Current escalation work can say:
- accept cheap path,
- request deeper verification,
- fail closed.

But it does not yet define the runtime routing model behind those outcomes. That creates two risks:
1. "request deeper verification" remains a label without a concrete path structure,
2. the system lacks a principled way to preserve useful behavior under uncertainty without pretending certainty.

## Proposed runtime integration delta
Add a deterministic **primary/backup verification routing gate** after the meta-reasoning escalation step.

### Primary path
Cheap/default inference path:
- existing signal→screen + abductive scorer outputs,
- low latency,
- low compute cost,
- only used when diagnostics are sufficiently healthy.

### Backup path
Deeper verification path:
- richer feature extraction,
- stronger contradiction checks,
- expanded explanation trace review,
- tighter per-case budget and artifact logging.

### Router inputs
The router should consume:
- escalation outcome,
- contradiction score,
- explanation margin,
- alternative density,
- debt state,
- resource budget / verification budget,
- derivation/version-risk flags.

### Deterministic routing outcomes
Proposed reasons:
- `tactic-routing-primary-path`
- `tactic-routing-backup-path`
- `tactic-routing-fail-closed`
- `tactic-routing-budget-exhausted`

### Policy shape
- clean diagnostics + healthy budget => primary path
- salvageable uncertainty + healthy backup budget => backup path
- hostile contradiction/version-risk => fail closed
- salvageable uncertainty + exhausted backup budget => budget-exhausted or fail-closed depending on severity

## Smallest testable slice
Implement a simulation/tooling evaluator in `packages/protocol` that:
- accepts escalation outputs + compact budget/health inputs,
- emits deterministic primary/backup/fail-closed routing outcomes with stable artifact hash.

## Acceptance criteria
Task-1 routing slice is complete when:
1. clean diagnostic bundle routes to `tactic-routing-primary-path`,
2. mixed-but-salvageable bundle routes to `tactic-routing-backup-path`,
3. hostile contradiction/version-risk bundle routes to `tactic-routing-fail-closed`,
4. salvageable case with exhausted backup budget yields `tactic-routing-budget-exhausted`,
5. identical bundles produce identical artifact hash,
6. `bun test` for the new slice passes,
7. `bunx tsc --noEmit -p packages/protocol` passes.

## Non-goals
- do **not** implement live backup verification internals in this slice,
- do **not** claim anti-gaming is solved,
- do **not** silently bypass escalation artifacts.

## Why this matters
The key question is not only **"should the system escalate?"**
It is also **"where should the work go once escalation happens?"**

That routing layer is what turns diagnostics into a resilient control flow instead of a decorative decision tree.

## Next Task
Lane F: red-team the primary/backup verification routing plan for budget-drain abuse, backup-path farming, and forced fail-closed routing.
