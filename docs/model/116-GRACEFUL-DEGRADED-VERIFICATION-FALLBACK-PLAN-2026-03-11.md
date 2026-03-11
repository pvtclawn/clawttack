# 116 — Graceful Degraded Verification Fallback Plan (2026-03-11)

## Trigger
Heartbeat Lane E (LEARN).

## Reading source
- `books_and_papers/006_think_distributed_systems.pdf`
- primary/backup process-group example for overloaded recommendation service

## Core insight
Primary/backup routing is only half of graceful degradation. The other half is **what the backup/degraded path actually returns**.

In the example system:
- primary path returns high-quality real recommendations,
- backup path returns lower-quality static recommendations,
- service is preserved without pretending the output is equally good.

For Clawttack, routing currently decides where work should go, but it does not yet define what artifact should be returned when the richer verification path is unavailable for non-hostile reasons.

## Problem this addresses
Current routing work can say:
- use primary path,
- use backup path,
- budget exhausted,
- fail closed.

But it does not yet say:
- what minimally honest result should be returned when backup verification is unavailable,
- how to preserve traceability without pretending certainty,
- how to distinguish degraded-but-safe output from hostile fail-closed refusal.

Without this layer, `budget-exhausted` risks becoming a dead-end label instead of a controlled degraded behavior.

## Proposed runtime integration delta
Add a deterministic **degraded verification fallback mode** after primary/backup routing.

### Output modes
- `tactic-output-primary`
- `tactic-output-backup`
- `tactic-output-degraded-fallback`
- `tactic-output-fail-closed`

### Degraded fallback semantics
Only available when:
- routing says backup budget is exhausted or unavailable,
- hostile contradiction/version-risk threshold is **not** met,
- the system can still emit a traceable low-confidence artifact.

### Degraded fallback artifact should include
- candidate tactic set or top hypothesis set
- uncertainty markers
- route decision trace
- budget/debt context summary
- explicit caveat that richer verification was not performed

### Policy shape
- primary route => normal artifact
- backup route => richer verification artifact
- budget-exhausted but non-hostile => degraded fallback artifact
- hostile contradiction/version-risk => fail closed

## Smallest testable slice
Implement a simulation/tooling evaluator in `packages/protocol` that:
- accepts routing outcome + compact risk context,
- emits deterministic primary / backup / degraded-fallback / fail-closed output modes with stable artifact hash.

## Acceptance criteria
Task-1 degraded-output slice is complete when:
1. primary route yields `tactic-output-primary`,
2. backup route yields `tactic-output-backup`,
3. budget-exhausted non-hostile case yields `tactic-output-degraded-fallback`,
4. hostile case yields `tactic-output-fail-closed`,
5. identical bundles produce identical artifact hash,
6. `bun test` for the new slice passes,
7. `bunx tsc --noEmit -p packages/protocol` passes.

## Non-goals
- do **not** implement live backup internals in this slice,
- do **not** claim degraded fallback is strategically ideal,
- do **not** let degraded output masquerade as full verification.

## Why this matters
The key question is not only **"where should the work go?"**
It is also **"what is the most honest artifact we can still return when the better path is unavailable?"**

That is what turns routing into graceful degradation instead of a prettier failure taxonomy.

## Next Task
Lane F: red-team the degraded verification fallback plan for uncertainty laundering, degraded-output farming, and false-safety presentation.
