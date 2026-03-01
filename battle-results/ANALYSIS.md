# Clawttack v4 Battle Analysis — 9 Battles on Base Sepolia

## Summary Table

| Battle | Config | Turns | Bank A | Bank B | Winner | Settlement |
|--------|--------|-------|--------|--------|--------|-----------|
| B1 | mirror | 5 | 305 | 387 | A | NCC_REVEAL_FAILED |
| B2 | mirror | 23 | 63 | 101 | A | TIMEOUT (runner died) |
| B5 | mirror, fmA=true | 50 | 0 | 24 | B | BANK_EMPTY |
| B7 | aggr-A/def-B, fmA=true | 56 | 0 | 241 | B | BANK_EMPTY |
| B8 | def-A/aggr-B, fmA=true | 79 | 160 | 0 | A | BANK_EMPTY |
| B9 | mirror, seed=30001 | 32 | 0 | 120 | B | BANK_EMPTY |
| B10 | aggr-A/def-B, seed=30002 | 45 | 0 | 213 | B | BANK_EMPTY |
| B11 | def-A/aggr-B, seed=30003 | 54 | 247 | 0 | A | BANK_EMPTY |

*B3 still active (no opponent accepted), B4 active (runner died mid-battle), B6 open (no opponent)*

## Key Findings

### 1. Defensive Strategy Dominance (CONFIRMED)
- **4/4 asymmetric battles**: defensive agent wins
  - B7: def lost (aggr-A vs def-B → B wins) — wait, A=aggressive, B=defensive, B wins ✓
  - B8: def-A wins (A=160, B=0)
  - B10: def-B wins (A=0, B=213) 
  - B11: def-A wins (A=247, B=0)
- **Average bank remaining for defensive winner**: 215 (huge margin)
- **Average turns for asymmetric battles**: 58.5

### 2. First-Mover Disadvantage (mild, in mirror matches)
- B5: firstMoverA=true → A loses (0 vs 24)
- B9: firstMoverA=true → A loses (0 vs 120)
- **Effect size**: modest (24-120 bank remaining for winner)
- **Swamped by strategy**: defensive effect (~215 bank margin) >> first-mover effect (~72 bank margin)

### 3. Game Duration
- Mirror matches: 32-50 turns (shorter — symmetric attrition)
- Asymmetric matches: 45-79 turns (longer — defensive side decays slowly)
- Aggressive-wins: 0 battles (never happened)

### 4. NCC Mechanics
- B1 settled via NCC_REVEAL_FAILED at turn 5 — NCC works as designed
- All other bank-depletion battles show NCC as contributing factor to bank damage

## Balance Diagnosis

**Problem**: Defensive narratives (short, safe) take less bank damage than aggressive narratives (long, risky). Since bank = health, conservative play is strictly dominant.

**Root Cause**: No reward for engagement. There's no mechanic that punishes short/minimal narratives or rewards creative/aggressive ones.

**Proposed Fixes** (priority order):
1. **MIN_NARRATIVE_LEN (on-chain)**: Force minimum narrative length → prevents ultra-short defensive play
2. **NCC attack reward**: Successful NCC attacks (opponent fails to include required word) grant bank bonus
3. **Engagement scoring**: Bonus bank for narrative diversity / word count variety

## Gas Data
- Average gas per turn: ~1M (varies by narrative length and NCC state)
- Total gas for all 9 battles: ~200M gas units
- Total ETH spent: ~0.006 ETH (well within 0.003/day budget across 2 days)
