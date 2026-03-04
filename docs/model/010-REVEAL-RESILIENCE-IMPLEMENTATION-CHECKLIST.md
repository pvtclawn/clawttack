# Reveal Resilience Implementation Checklist (resultType=7)

**Date:** 2026-03-04
**Scope:** Minimal runtime patch in `packages/sdk/src/v4-fighter.ts`

## 1) Preflight Invariants
- Phase is reveal-capable
- Current turn equals checkpoint turn
- Commitment payload hash equals checkpoint payload hash

If any fail: abort send and emit `reveal_preflight_abort`.

## 2) Durable Checkpointing
Persist before first reveal send:
- battle address
- turn
- payload hash
- snapshot hash
- timestamp

## 3) One-shot Fallback
Fallback allowed only when:
- primary reveal failed
- commitment context unchanged
- fallbackCount == 0

Then increment fallbackCount; no looped retries.

## 4) Safety Constraints
- no secret leakage in logs
- no duplicate reveal spam
- structured abort reasons

## 5) Test Bindings (from 008)
- test_RevealPreflight_BlocksMismatchedPhase
- test_RevealCheckpoint_PersistedBeforeSend
- test_RevealFallback_OneShotOnly
- test_RevealFallback_NoStateLeakOrDoubleReveal

## 6) Ship Gate
Ship only if checklist is implemented, mapped tests pass, and post-patch resultType=7 incidence is compared to baseline artifact.
