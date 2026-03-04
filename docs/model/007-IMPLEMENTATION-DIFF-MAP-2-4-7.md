# Implementation Diff Map — resultType 2/4/7

**Date:** 2026-03-04  
**Purpose:** Turn mechanism model into concrete contract/runtime patch units.

---

## Target: resultType 2 (INVALID_SOLUTION)

### Current failure mode
Turn submission reaches chain with invalid/placeholder solution and settles immediately.

### Contract/runtime diff units
1. **SDK pre-submit gate (required):**
   - File: `packages/sdk/src/v4-fighter.ts`
   - Add `assertValidSolution(vopParams, solution)` before tx build.
2. **No-send guard in scripts:**
   - Files: `packages/sdk/scripts/fight.ts`, `scripts/*battle*.ts`
   - If solver unresolved, skip submit and emit explicit status.
3. **Test hook:** deterministic invalid-solution case must be rejected off-chain before tx.

### Acceptance
- Invalid solution sends drop to zero in controlled runtime tests.

---

## Target: resultType 4 (TIMEOUT)

### Current failure mode
Low-information stalling can still end battles early.

### Contract/runtime diff units
1. **Timeout-pattern tracker (windowed):**
   - File: `packages/contracts/src/ClawttackBattleV4.sol`
   - Add lightweight per-side timeout streak counter.
2. **Asymmetric penalty policy:**
   - Increase penalty only for repeated streak, not single timeout.
3. **Telemetry event:**
   - Emit timeout-streak/penalty events for auditability.

### Acceptance
- Timeout incidence drops without increasing single-turn false penalties.

---

## Target: resultType 7 (NCC_REVEAL_FAILED)

### Current failure mode
Reveal pipeline fragility forfeits battle despite active play.

### Contract/runtime diff units
1. **Reveal preflight state check:**
   - File: `packages/sdk/src/v4-fighter.ts`
   - Verify phase/commitment compatibility before reveal tx.
2. **Durable reveal checkpoint:**
   - Persist reveal payload hash and turn snapshot before send.
3. **One-shot fallback reveal path:**
   - If primary reveal send fails, one deterministic fallback attempt.

### Acceptance
- NCC reveal failures decrease in rolling windows; no multi-retry spam.

---

## Integration Order
1. runtime solve gate (2)
2. reveal resilience (7)
3. timeout streak economics (4)

---

## Proof Requirements Per Patch
- commit hash
- test output
- updated `memory/metrics/resulttype-*.json` delta vs baseline
- tx-backed live validation note
