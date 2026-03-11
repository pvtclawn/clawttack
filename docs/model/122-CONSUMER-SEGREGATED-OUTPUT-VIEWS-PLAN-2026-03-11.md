# 122 — Consumer-Segregated Output Views Plan (2026-03-11)

## Trigger
Heartbeat Lane E (LEARN).

## Reading source
- `books_and_papers/003_solid_software.pdf`
- interface-focused design / public-interface sections

## Core insight
Interfaces should not force consumers to depend on fields or behaviors they do not need. A single oversized interface becomes harder to reason about, easier to misuse, and more likely to leak implementation detail.

For Clawttack, even a correct dual-surface split (public vs audit) may still be too coarse. Different consumers inside the trusted or semi-trusted boundary may need different minimal views.

## Problem this addresses
Current output-contract work separates public and audit surfaces, but it does not yet define:
- which audit consumers get which subset of audit fields,
- how research/metrics tooling differs from operator/debug views,
- how future machine consumers avoid over-depending on internal artifact richness.

Without this layer, the audit surface risks becoming a new oversized interface that quietly reintroduces leakage and coupling.

## Proposed runtime integration delta
Add a deterministic **consumer-segregated output view gate** after the dual-surface contract compiler.

### Input surfaces
- public contract artifact
- audit contract artifact
- consumer capability / role

### Example consumer roles
- `public-reader`
- `operator-debug`
- `research-metrics`
- `internal-verifier`

### Deterministic outcomes
Proposed outputs:
- `tactic-output-view-public-reader`
- `tactic-output-view-operator-debug`
- `tactic-output-view-research-metrics`
- `tactic-output-view-internal-verifier`

### Policy shape
- public readers receive the minimal normalized public contract only,
- operator/debug views receive route/risk context needed for diagnosis,
- research/metrics views receive structured aggregate-friendly fields without unnecessary raw internals,
- internal verifier views may receive the richest machine-oriented structure,
- every field must have an explicit consumer-visibility reason.

## Smallest testable slice
Implement a simulation/tooling evaluator in `packages/protocol` that:
- accepts a compact contract artifact + consumer role,
- emits deterministic consumer-specific views with stable artifact hash.

## Acceptance criteria
Task-1 consumer-view slice is complete when:
1. `public-reader` sees only the minimal public-safe fields,
2. `operator-debug` can see route/risk context absent from `public-reader`,
3. `research-metrics` gets structured aggregate-friendly fields but not unnecessary raw internals,
4. identical inputs produce identical consumer-view artifact hashes,
5. `bun test` for the new slice passes,
6. `bunx tsc --noEmit -p packages/protocol` passes.

## Non-goals
- do **not** build the full runtime authz layer in this slice,
- do **not** expose audit-rich views to public consumers,
- do **not** claim oracle resistance is solved by interface segregation alone.

## Why this matters
The key question is not only **"what is public vs audit?"**
It is also **"which consumer actually needs which fields, and what should they never depend on?"**

That is how output artifacts stop becoming oversized shared interfaces.

## Next Task
Lane F: red-team the consumer-segregated output-view plan for capability creep, role confusion, and cross-view field bleed.
