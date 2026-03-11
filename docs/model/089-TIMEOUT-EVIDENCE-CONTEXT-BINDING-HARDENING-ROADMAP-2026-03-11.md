# 089 — Timeout Evidence Context-Binding Hardening Roadmap (2026-03-11)

## Context
Task source:
- `docs/model/088-TIMEOUT-EVIDENCE-CONTEXT-BINDING-GATE-PLAN-2026-03-11.md`

Red-team source:
- `docs/research/TIMEOUT-EVIDENCE-CONTEXT-BINDING-REDTEAM-2026-03-11.md`

Goal: convert context-binding red-team findings into constrained hardening tasks with deterministic acceptance criteria.

## Task 1 — Canonical context grammar + operation-domain lock
Implement deterministic context canonicalization and domain separation:
1. strict canonical grammar for `arena`, `operationId`, `providerId`, and tuple fields,
2. operation-class domain tag binding,
3. ambiguous alias hard-fail path.

### Acceptance criteria
- Canonicalization collision fixtures fail with `timeout-evidence-canonicalization-invalid`.
- Cross-operation graft fixtures fail with `timeout-evidence-operation-scope-mismatch`.
- Canonical fresh context passes deterministically.

## Task 2 — Monotonic counter-window progression invariants
Implement deterministic progression guard for `(windowId,counter)`:
1. monotonic progression with explicit rollover contract,
2. regression/skip detection,
3. active-window replay rejection.

### Acceptance criteria
- Counter-window desync fixtures fail with `timeout-evidence-counter-window-invalid`.
- Replay in active window fails with `timeout-evidence-context-replay`.
- Proper fresh progression passes with stable artifact hash.

## Task 3 — Provider identity authenticity + replay retention policy
Implement provider identity binding and replay-after-eviction protection:
1. provider fingerprint/class authenticity binding,
2. alias spoof detection,
3. sticky tombstones with class-specific minimum retention.

### Acceptance criteria
- Provider alias spoof fixtures fail with `timeout-evidence-provider-identity-invalid`.
- Replay-after-eviction fixtures fail with `timeout-evidence-replay-after-eviction`.
- Valid provider-bound fresh evidence passes deterministically.

## Next Task (single)
Lane B: implement Task 1 in `packages/protocol` (canonical context grammar + operation-domain lock evaluator + fixtures), no runtime wiring in same slice.
