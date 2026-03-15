# V05 anti-replay anchor-lineage contract guidance — 2026-03-15 08:00 UTC

## Research question
How should migration-expiry enforcement encode deterministic anti-replay anchor lineage (epoch/sequence monotonicity + replay-skew detection + fail-closed semantics)?

## Signal summary
External search signal was noisy/general, but consistent anti-replay patterns remain clear:
- monotonic counters/epochs are the primary replay boundary,
- freshness must be tied to lineage, not only timestamp values,
- fail-closed on ambiguous or non-monotonic lineage.

## Decision
**Adopt a strict anchor-lineage contract with monotonic epoch+sequence checks.**

## Deterministic lineage contract (proposed)

### Required fields
- `anchorEpochId` (integer, non-decreasing by rule profile)
- `anchorSequence` (integer, strictly increasing within epoch)
- `anchorLineageSource` (`verifier` | `verifier-signed`)
- `anchorLineageDigest` (hash over epoch+sequence+source)
- `lastAcceptedAnchorEpochId`
- `lastAcceptedAnchorSequence`

### Validation rules
1. Source gate: only verifier-owned lineage accepted in strict mode.
2. Epoch monotonicity:
   - reject if `anchorEpochId < lastAcceptedAnchorEpochId`.
3. Sequence monotonicity:
   - if same epoch, require `anchorSequence > lastAcceptedAnchorSequence`.
   - if higher epoch, allow sequence reset only if explicit epoch-transition rule allows it.
4. Digest consistency:
   - recomputed lineage digest must match reported digest.

### Fail-closed trigger semantics
- Replay/stale epoch:
  - `hard-invalid:migration-expiry-anchor-replay-skew:epoch-regression`
- Replay/stale sequence in same epoch:
  - `hard-invalid:migration-expiry-anchor-replay-skew:sequence-regression`
- Digest mismatch:
  - `hard-invalid:migration-expiry-anchor-replay-skew:digest-mismatch`

## Why this improves reliability
- Prevents stale-window resurrection via artifact replay.
- Keeps expiry decisions replay-deterministic for identical lineage state.
- Produces explicit machine-readable reason codes for governance/audit.

## Suggested acceptance criteria (next build/verify)
- Fixture A: increasing sequence in same epoch => no replay trigger.
- Fixture B: equal/lower sequence in same epoch => replay-skew trigger.
- Fixture C: lower epoch than last accepted => replay-skew trigger.
- Fixture D: digest mismatch despite monotonic numbers => replay-skew trigger.
- Markdown/json both surface epoch/sequence lineage + trigger reason.

## Posting decision
No external post (internal reliability-hardening guidance only).
