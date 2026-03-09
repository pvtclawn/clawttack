# Forge Test Matrix — resultType 2/4/7 hardening

**Date:** 2026-03-04

---

## Suite A — Invalid Solution Guard (2)

1. `test_InvalidSolution_PreflightRejectsBeforeSubmit()`
   - Arrange invalid VOP solution in fighter runtime.
   - Expect no tx broadcast attempt.

2. `test_ValidSolution_SubmitSucceeds()`
   - Valid VOP solution path submits and advances turn.

3. `test_NoPlaceholderSolutionCanReachSendPath()`
   - Guard against `0`/unset defaults entering send pipeline.

---

## Suite B — Timeout Economics (4)

1. `test_SingleTimeout_NoEscalationPenalty()`
2. `test_RepeatedTimeout_StreakPenaltyEscalates()`
3. `test_StreakDecay_AfterCompliantTurns()`
4. `test_TimeoutPenalty_DoesNotBreakLiveness()`

---

## Suite C — NCC Reveal Resilience (7)

1. `test_RevealPreflight_BlocksMismatchedPhase()`
2. `test_RevealCheckpoint_PersistedBeforeSend()`
3. `test_RevealFallback_OneShotOnly()`
4. `test_RevealFallback_NoStateLeakOrDoubleReveal()`

---

## Cross-Cutting Regression

1. `test_ResultTypeIncidenceExtractor_ParsesBattleSettledEvents()`
2. `test_MetricsWindow_StableAgainstLogChunking()`
3. `test_UIPath_OnChainOnly_NoPublicJsonDependency()`

---

## Ship Gate

A patch batch is shippable only if:
- all matrix tests pass,
- resultType incidence artifact delta is produced,
- at least one live tx-backed validation is logged.
