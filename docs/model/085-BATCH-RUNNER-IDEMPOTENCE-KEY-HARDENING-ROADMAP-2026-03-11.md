# 085 — Batch Runner Idempotence-Key Hardening Roadmap (2026-03-11)

## Context
Task source:
- `docs/model/084-BATCH-RUNNER-IDEMPOTENCE-KEY-GATE-PLAN-2026-03-11.md`

Red-team source:
- `docs/research/BATCH-RUNNER-IDEMPOTENCE-KEY-GATE-REDTEAM-2026-03-11.md`

Goal: convert red-team findings into constrained, merge-sized hardening tasks with deterministic acceptance gates.

## Task 1 — Intent-binding integrity + schema lock
Implement deterministic intent-binding checks:
1. canonical intent schema requirement,
2. schema-version pinning,
3. full-field commitment validation for opKey derivation.

### Acceptance criteria
- Mutated retry with unchanged opKey seed fails `runner-op-intent-binding-invalid`.
- Missing required intent fields fail deterministically with same reason.
- Same canonical tuple yields same verdict + artifact hash.

## Task 2 — Scope canonicalization + domain-separated key derivation
Implement deterministic scope/domain hardening:
1. canonical `battleScope` normalization,
2. batch/epoch namespace binding for create intents,
3. domain-separated key prefix enforcement by operation class.

### Acceptance criteria
- Alias scope inputs fail with `runner-op-scope-canonicalization-failed`.
- Cross-operation key-shape collisions fail with `runner-op-domain-separation-invalid`.
- Canonical scope/domain tuples pass with stable artifact hash.

## Task 3 — Concurrent conflict reducer + retention/tombstone policy
Implement deterministic concurrency and replay-after-eviction protection:
1. CAS-style winner/loser conflict resolution,
2. deterministic conflict reasoning,
3. operation-class retention windows + sticky tombstones for critical ops.

### Acceptance criteria
- Parallel same-key attempts yield one winner; loser gets `runner-op-concurrent-conflict`.
- Replay after TTL-prune in protected window fails `runner-op-replay-after-eviction`.
- Reordered equivalent conflict traces resolve to same deterministic final verdict.

## Next Task (single)
Lane B: implement Task 1 in `packages/protocol` (intent-binding integrity + schema lock evaluator + fixtures), no runner runtime wiring in same slice.
