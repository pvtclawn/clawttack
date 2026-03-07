# Patch Sketch — resultType 7 (NCC_REVEAL_FAILED)

**Date:** 2026-03-04  
**Objective:** reduce accidental reveal forfeits without introducing replay/leak vectors.

---

## 1) Problem Signature

Observed short-settle includes `resultType=7` (NCC reveal failure), often from runtime/state mismatch rather than strategic defeat.

---

## 2) Minimal Runtime Patch

### A. Preflight reveal invariant check (required)
Before sending reveal tx:
- phase is reveal-capable,
- current turn snapshot matches expected,
- commitment payload hash matches stored checkpoint.

If any fail: no send.

### B. Durable reveal checkpoint
Persist before first reveal attempt:
- `battleAddress`
- `turn`
- `payloadHash`
- `snapshotHash`
- `createdAt`

### C. One-shot fallback
If primary reveal attempt fails for transient infra reasons:
- re-read state,
- verify same commitment context,
- send one fallback reveal attempt,
- never loop.

---

## 3) Safety Guardrails

1. Fallback allowed only if commitment context unchanged.  
2. Fallback count max = 1.  
3. No additional private state emitted in fallback path logs.

---

## 4) Test Hooks (from 008)

- `test_RevealPreflight_BlocksMismatchedPhase()`
- `test_RevealCheckpoint_PersistedBeforeSend()`
- `test_RevealFallback_OneShotOnly()`
- `test_RevealFallback_NoStateLeakOrDoubleReveal()`

---

## 5) Acceptance

Over rolling window after deployment:
- `rate(resultType=7)` decreases vs baseline,
- no increase in duplicate reveal attempts,
- no liveness regressions in valid reveal flows.

---

## 6) Implementation Surface

- `packages/sdk/src/v4-fighter.ts` (primary)
- `packages/sdk/scripts/fight.ts` (operator/runtime wiring)
- optional checkpoint schema update in `battle-results/fighter-state/` handling.
