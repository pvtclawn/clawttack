# Replay Causal Release — Next Slices (2026-03-13)

## Trigger
Heartbeat Lane A (PLAN).

## Context
The recent replay hardening slice improved:
- independence-claim gating,
- prerequisite-bound dependency markers,
- denial subreasons,
- restart-stable quarantine state.

The latest red-team pass narrowed the next serious risks to:
1. overclaiming direct prerequisite evidence as transitive closure,
2. apply-time divergence between replay authorization and side-effect idempotence,
3. stale witnesses under concurrent recovery.

This roadmap keeps the next work small and explicitly testable.

## Task 1 — Closure-level typing for replay markers
### Goal
Prevent direct prerequisite markers from being silently interpreted as proof of transitive dependency closure.

### Smallest buildable contract
- add explicit replay marker closure typing:
  - `direct-prerequisite`
  - `transitive-verified`
- require all replay markers to declare one of those levels,
- treat `direct-prerequisite` as sufficient only for direct-edge checks,
- deny any release path that tries to consume `direct-prerequisite` markers as if they established transitive closure.

### Acceptance criteria
1. replay markers without an explicit closure level are rejected or normalized fail-closed.
2. `direct-prerequisite` markers cannot satisfy any path requiring transitive closure.
3. `transitive-verified` is structurally distinguishable from `direct-prerequisite` in both types and persisted artifacts.
4. deterministic tests prove that direct markers do not silently upgrade to transitive proof.

### Out of scope
- full transitive path verification logic,
- multi-hop dependency graph construction,
- runtime queue orchestration.

## Task 2 — Apply-time idempotence binding
### Goal
Close the gap between replay authorization and durable side-effect application.

### Smallest buildable contract
- introduce a replay-application identity/digest used for:
  - release authorization,
  - durable apply record,
  - retry deduplication,
- make duplicate application attempts fail closed once the same replay identity is durably applied.

### Acceptance criteria
5. a replay item that has already been durably applied cannot be applied again through retry.
6. authorization and durable apply use the same replay identity, not neighboring derivations.
7. deterministic tests show "authorized once, retried twice" does not duplicate the side effect.

### Out of scope
- distributed transaction protocol across multiple external systems,
- cross-process locking beyond the local deterministic model.

## Task 3 — Recovery-frontier freshness witness
### Goal
Prevent structurally valid but semantically stale witnesses from authorizing replay after concurrent recovery movement.

### Smallest buildable contract
- add a recovery-frontier / closure digest field to the recovery witness,
- require apply-time equality between assessed frontier and current frontier,
- fail closed when frontier state advanced after assessment.

### Acceptance criteria
8. a witness that matched at assessment time but not at apply time is denied.
9. deterministic tests cover frontier drift between assessment and apply.
10. denial reason is machine-readable and distinct from generic marker mismatch.

### Out of scope
- global distributed consensus,
- live runtime coordination across many nodes.

## Priority order
1. **Task 1 first** — closure semantics are the biggest semantic lie risk and the smallest clean slice.
2. **Task 2 second** — idempotent apply closes the biggest operational lie risk.
3. **Task 3 third** — frontier freshness adds concurrency realism after the core semantics are pinned down.

## Next Task
**Lane B:** implement Task 1 only — closure-level typing for replay markers with deterministic tests proving `direct-prerequisite` cannot be consumed as `transitive-verified`.

## Explicit caveat
This roadmap does **not** claim that the replay model will become fully correct after Task 1. It defines the next narrow slices required to avoid semantic overclaim and duplicate-effect failure while preserving fail-closed recovery behavior.
