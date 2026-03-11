# 123 — Consumer View Hardening Roadmap (2026-03-11)

## Trigger
Heartbeat Lane A (PLAN).

## Inputs
- Base plan: `docs/model/122-CONSUMER-SEGREGATED-OUTPUT-VIEWS-PLAN-2026-03-11.md`
- Red-team report: `docs/research/CONSUMER-SEGREGATED-OUTPUT-VIEWS-REDTEAM-2026-03-11.md`

## Goal
Turn the consumer-segregated output-view direction into a mergeable sequence of deterministic hardening slices that keep role-specific interfaces minimal, auditable, and hard to blur together.

## Failure classes to target
1. **Capability creep** — narrow views slowly accrete fields until they become oversized again.
2. **Role ambiguity** — adjacent roles become semantically blurry and field exposure becomes inconsistent.
3. **Cross-view leakage** — fields intended for one role bleed into another role’s view or cause same-case divergence.

## Constrained tasks

### Task 1 — Explicit role matrix + centralized view compiler
**Why first:** without a single compiler and an explicit role/field matrix, later bleed and authz guards are built on shifting sand.

**Scope**
- deterministic evaluator in `packages/protocol`
- input: compact contract artifact + explicit role matrix + selected consumer role
- outputs:
  - `tactic-output-view-public-reader`
  - `tactic-output-view-operator-debug`
  - `tactic-output-view-research-metrics`
  - `tactic-output-view-internal-verifier`
- all views must be compiled from one centralized boundary using an explicit field-visibility matrix
- artifact hashes must be stable for identical inputs

**Acceptance criteria**
1. `public-reader` sees only minimal public-safe fields
2. `operator-debug` sees route/risk context absent from `public-reader`
3. `research-metrics` gets structured aggregate-friendly fields but not unnecessary raw internals
4. `internal-verifier` can receive the richest machine-oriented structure allowed by the matrix
5. identical inputs produce identical consumer-view artifact hashes
6. `bun test` for the slice passes
7. `bunx tsc --noEmit -p packages/protocol` passes

### Task 2 — Cross-view bleed + divergence guard
**Why second:** once views are compiled centrally, the next risk is porous boundaries and inconsistent same-case projections.

**Scope**
- explicit fixtures for role confusion, cross-view field bleed, and same-case divergence
- shared-origin linkage must persist across consumer views

**Acceptance criteria**
1. public/research/operator field-bleed fixture fails
2. same-case views retain shared origin while preserving allowed role-specific differences
3. identical inputs produce identical artifact hashes
4. `bun test` for the slice passes
5. `bunx tsc --noEmit -p packages/protocol` passes

### Task 3 — Capability-binding guard
**Why third:** role names should not be treated like caller-controlled formatting options.

**Scope**
- require explicit capability-binding input separate from rendering choice
- richer views must not be selectable by convention alone

**Acceptance criteria**
1. unauthorized richer-view selection fixture is rejected
2. rendering logic cannot bypass capability assignment
3. identical inputs produce identical artifact hashes
4. `bun test` for the slice passes
5. `bunx tsc --noEmit -p packages/protocol` passes

## Smallest mergeable milestone today
Implement **Task 1 only** in `packages/protocol` as a simulation/tooling slice. No runtime authz wiring, no multi-layer serializer refactor, no claim that role confusion or field bleed is solved.

## Narrative-quality target
This roadmap succeeds only if consumer views become smaller and clearer without recreating a hidden all-purpose internal interface.

## Next Task
Lane B: implement Task 1 in `packages/protocol` (explicit role matrix + centralized view compiler), no runtime wiring in the same slice.
