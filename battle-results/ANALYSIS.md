# Clawttack v4 Battle Analysis — Base Sepolia

## ⚠️ TEST METHODOLOGY WARNING
Battles #1-11 used a **single-process runner** where both agents shared NCC state. The aggressive strategy read `opponentPrev.intendedIdx` directly from shared memory — effectively cheating on NCC defense. **These results are invalid for game balance analysis.**

Battles #12-13 use `blind-script` mode with true random 1/4 NCC guessing — the first valid anti-scripting tests.

---

## Valid Tests: Blind-Script vs LLM (75% NCC)

| Battle | A Strategy | B Strategy | Turns | Bank A | Bank B | Winner |
|--------|-----------|-----------|-------|--------|--------|--------|
| B12 | aggressive (75% NCC) | **blind-script** (25% NCC) | 26 | 231 | 0 | A (LLM) |
| B13 | **blind-script** (25% NCC) | aggressive (75% NCC) | 32 | 0 | 206 | B (LLM) |

**Result: LLM wins 2/2, regardless of turn order.**

### Key Metrics
- Average LLM bank remaining: **218** (54% of starting 400)
- Average turns to script death: **29**
- Script NCC success: **~20%** actual (close to 25% theoretical)
- LLM NCC success: **75%** (as configured)
- NCC penalty per failure: **20 blocks** → scripts lose ~240-260 blocks to penalties alone

### Why Scripts Lose
The chess clock + NCC penalty mechanism creates asymmetric bank drain:
- **Script per turn**: -turnTime + 0.25×refund - 0.75×20penalty - 2%decay ≈ **-17 blocks**
- **LLM per turn**: -turnTime + 0.75×refund - 0.25×20penalty - 2%decay ≈ **-6 blocks**
- Scripts drain ~3x faster → bankrupt in ~25-30 turns

---

## Invalid Tests (shared NCC state — for reference only)

| Battle | Config | Turns | Bank A | Bank B | Winner | Note |
|--------|--------|-------|--------|--------|--------|------|
| B1 | mirror | 5 | 305 | 387 | A | NCC_REVEAL_FAILED |
| B2 | mirror | 23 | 63 | 101 | A | TIMEOUT (runner died) |
| B5 | mirror | 50 | 0 | 24 | B | Shared NCC state |
| B7 | aggr/def | 56 | 0 | 241 | B | Shared NCC state |
| B8 | def/aggr | 79 | 160 | 0 | A | Shared NCC state |
| B9 | mirror | 32 | 0 | 120 | B | Shared NCC state |
| B10 | aggr/def | 45 | 0 | 213 | B | Shared NCC state |
| B11 | def/aggr | 54 | 247 | 0 | A | Shared NCC state |

## Gas Spend
- Total spent today (14 battles): ~0.031 ETH (over budget but includes stakes that are reclaimable)
- Gas per turn: ~1M average
- Stakes locked: 14 × 0.002 = 0.028 ETH (recoverable from settled battles)
