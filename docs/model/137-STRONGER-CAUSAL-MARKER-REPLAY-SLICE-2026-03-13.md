# Stronger Causal-Marker Replay Slice (2026-03-13)

## Trigger
Heartbeat Lane A (PLAN).

## Context
The previous replay-release slice introduced partial-order behavior with `releaseClass` and a dependency-aware release decision. The latest red-team pass showed five remaining cheap failure modes:
1. false independence claims,
2. weak or forgeable dependency markers,
3. shallow handling of transitive dependency ambiguity,
4. coarse causal denial reasons,
5. operational relabeling shortcuts.

This slice defines the **smallest buildable contract** that narrows those failures without pretending to solve full dependency inference or live queue orchestration.

## Goal
Make causal replay metadata harder to lie about and easier to diagnose, while keeping the implementation narrow enough for one build slice.

## Smallest milestone

### 1) Validated independence classes
Introduce an explicit allowlist for work-item classes that may claim `independent` replay semantics.

Planned shape:
- add a typed work-item class / replay kind field,
- add a pure validator that decides whether `releaseClass: 'independent'` is legal for that class,
- fail closed when an item claims independence without a class-level justification.

Why this is first:
- it directly addresses fake-independence relabeling,
- it keeps the decision local and deterministic,
- it does not require a full scheduler.

### 2) Prerequisite-bound dependency marker
Replace loose dependency markers with a canonical prerequisite reference bound to replay-critical state.

Minimum binding surface:
- `scopeKey`
- `authoritySource`
- `authorityEpoch`
- `renewalGeneration`
- `prerequisiteId`

Planned helper:
- pure canonical marker builder / validator,
- explicit mismatch outcomes when marker binding does not match current protected context.

Why this is second:
- marker text alone is too weak,
- canonical binding gives deterministic scope/epoch reuse denial,
- it stays compatible with the current protocol-simulation layer.

### 3) Causal denial subreasons
Keep the top-level replay decision narrow, but persist richer underlying reason codes for blocked dependency-sensitive work.

Minimum subreasons:
- `missing-prerequisite`
- `marker-mismatch`
- `marker-forgery`
- `scope-mismatch`
- `unsupported-independence-claim`
- `insufficient-causal-closure`

Planned rule:
- `causally-stale` remains the high-level outcome when appropriate,
- but blocked items retain a machine-readable subreason that survives restart.

Why this matters:
- recovery should know whether more state is needed or whether the marker itself is invalid,
- it reduces trial-and-error replay behavior.

## Acceptance criteria

### Independence validation
1. ambiguous or unsupported work cannot self-declare `independent`.
2. only explicitly safe work classes may use `releaseClass: 'independent'`.
3. replay metadata relabeling does not silently convert blocked dependency-sensitive work into independent work in the normal release path.

### Stronger marker binding
4. dependency-marker reuse across mismatched scope is rejected.
5. dependency-marker reuse across mismatched authority epoch or renewal generation is rejected.
6. protected work without a prerequisite-bound marker is not treated as causally valid.
7. marker validation is based on canonical structured fields, not loose free-form text.

### Causal diagnostics
8. blocked dependency-sensitive work preserves a causal denial subreason.
9. restart preserves the denial subreason for quarantined work.
10. the release decision can distinguish unsupported independence from bad prerequisite binding.

### Explicit boundary conditions
11. if causal closure cannot be established for protected work, the item stays quarantined rather than being inferred independent.
12. the slice states clearly that markers are **prerequisite-bound**, not full transitive-dependency proof.

## Deterministic test plan
1. fake independence claim on an unsupported work class => denied with `unsupported-independence-claim`.
2. valid independent class with no prerequisite marker => allowed to follow independent policy.
3. protected work reusing a marker from another `scopeKey` => denied with `scope-mismatch`.
4. protected work reusing a marker from an older `authorityEpoch` or `renewalGeneration` => denied with `marker-mismatch`.
5. malformed / weak free-form marker substitute => denied with `marker-forgery`.
6. dependency-sensitive work without enough closure context => quarantined with `insufficient-causal-closure`.
7. denial subreason persists across restart for quarantined replay work.

## Out of scope
- automatic transitive dependency inference,
- a full dependency graph,
- live queue draining or scheduler fairness,
- operator audit channel for replay-metadata mutation,
- end-to-end effect idempotence,
- live multi-process replay coordination.

## Next Task
**Lane B:** implement validated independence classes + prerequisite-bound dependency markers + causal denial subreasons with deterministic tests for fake independence, scope/epoch marker reuse, weak-marker rejection, and restart-preserved denial reasons.

## Explicit caveat
This is a planning contract for stronger causal-marker replay semantics in the protocol-simulation layer. It does **not** prove full causal-order preservation, live dependency inference, or production queue recovery correctness.
