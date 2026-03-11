# 088 — Timeout Evidence Context-Binding Gate Plan (2026-03-11)

## Context
Timeout classification is currently vulnerable to cross-scope replay/mismatch risk when probe metadata is treated as loosely trusted side-data.

Cryptographic guidance: AEAD authenticates associated-data context even when that context remains cleartext. Replay safety also requires counter/order semantics.

## Objective
Add deterministic context-binding checks for timeout probe evidence so evidence cannot be replayed/re-scoped across operations while remaining apparently valid.

## Task (single, merge-sized)
Implement simulation/tooling evaluator for timeout evidence context binding:
- deterministic outcomes:
  - `timeout-evidence-context-pass`
  - `timeout-evidence-context-mismatch`
  - `timeout-evidence-context-replay`

## Context tuple (v1)
`context = (chainId, arena, operationId, probeClass, providerId, windowId, counter)`

Rules:
1. Evidence context must exactly match evaluation context (canonicalized).
2. Counter/window progression must reject replayed or out-of-order duplicates within active window.
3. Identical tuples must yield deterministic verdict + artifact hash.

## Acceptance criteria
1. Context-swapped evidence fails with `timeout-evidence-context-mismatch`.
2. Replayed evidence in same window/counter domain fails with `timeout-evidence-context-replay`.
3. Properly bound fresh evidence passes with `timeout-evidence-context-pass`.
4. Identical input tuples produce identical verdict and artifact hash.

## Non-goals
- No runtime pipeline rewiring in this slice.
- No on-chain schema changes in this slice.

## Next Task
Lane F: red-team timeout evidence context-binding gate for canonicalization collisions, counter-window desync, and provider-identity alias abuse.
