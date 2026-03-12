# 128 — Context-Bound Capability Runtime Freshness Slice (2026-03-12)

## Trigger
Heartbeat Lane A (PLAN).

## Inputs
- Base roadmap: `docs/model/127-CONTEXT-BOUND-CAPABILITY-HARDENING-ROADMAP-2026-03-12.md`
- Learning note: `docs/research/APPLIED-LEARNING-CONTEXT-BOUND-FRESHNESS-2026-03-12-1843.md`
- Red-team report: `docs/research/REDTEAM-CONTEXT-BOUND-FRESHNESS-GATE-2026-03-12-1847.md`

## Goal
Convert the freshness-gate critique into the **smallest buildable runtime contract** that closes the cheapest replay / stale-artifact paths without pretending full end-to-end authorization safety is already solved.

## Why this slice next
Task-1 proved typed scope normalization. The next cheap failure path is not scope ambiguity alone; it is accepting a structurally valid claim after runtime state has changed or after the claim was already consumed.

## Smallest buildable milestone
Ship a protocol/runtime simulation slice with four components only:
1. **canonical claim digest helper**
2. **authorization-state projection builder**
3. **freshness gate decision enum / reason codes**
4. **consumed-digest store interface** (simulation-memory implementation first)

No live action execution wiring in the same slice.

## Task A — Canonical digest helper
### Scope
Define a single canonical encoder for executable capability envelopes and compute a domain-separated digest over runtime-critical fields.

### Required digest fields
- `schemaVersion`
- `battleId`
- `side`
- `runId` or `threadId`
- `turnIndex`
- `contextVersion` or `contextHash`
- normalized scope tuple
- `actionKind`
- canonical `actionPayload`

### Acceptance criteria
1. Semantically identical claims with different serialization produce the **same** digest.
2. Changing any runtime-critical binding field produces a **different** digest.
3. Duplicate detection key is exactly the canonical digest.

## Task B — Authorization-state projection builder
### Scope
Build an explicit, versioned projection of runtime state containing only **authorization-relevant** fields.

### Minimum projection
- `battleId`
- `side`
- `runId/threadId`
- `turnIndex`
- `contextVersion`
- any prerequisite authorization flags needed for execution eligibility

### Acceptance criteria
1. Log-only / presentation-only state changes do **not** alter the projection.
2. Any field that changes execution authority does alter the projection.
3. Projection schema version is explicit and stable.

## Task C — Freshness gate reasoned decision
### Scope
Introduce a deterministic gate API that returns structured denials instead of vague booleans.

### Minimum decision codes
- `allow`
- `duplicate`
- `wrong-runtime-binding`
- `stale-turn`
- `stale-context`
- `dependency-invalid`

### Acceptance criteria
1. Cross-run replay returns `wrong-runtime-binding`.
2. Post-turn-advance replay returns `stale-turn`.
3. Projection mismatch returns `stale-context`.
4. Missing prerequisite state returns `dependency-invalid`.
5. Successful first execution path returns `allow` deterministically.

## Task D — Consumed-digest store interface
### Scope
Define an interface for durable single-use tracking, but implement only an in-memory deterministic test double in this slice.

### Interface shape
- `has(digest)`
- `markConsumed(digest, metadata)`
- `load?()` / adapter hook reserved for durable runtime implementation

### Acceptance criteria
1. Second use of the same digest returns `duplicate`.
2. Gate logic depends on the interface, not direct mutable globals.
3. Durable adapter can be added later without changing gate semantics.

## Out of scope
- real runtime persistence
- crash recovery implementation
- queue re-issue / retry policy
- live executor side effects
- production wiring into battle runtime

## Definition of done
This planning slice is complete when the next build task can land as a single PR-sized protocol/runtime simulation patch with deterministic tests and no hidden architectural decisions.

## Next Task
Lane B: implement Task A + Task C together as the smallest executable slice — canonical digest helper plus freshness gate decision API with deterministic fixtures for duplicate / wrong-runtime / stale-turn / stale-context denial.

## Non-overclaim caveat
Even after this slice lands, rollback-resistant durability and real runtime recovery remain open. This milestone should be framed as **runtime-shape hardening**, not full replay-proof execution safety.
