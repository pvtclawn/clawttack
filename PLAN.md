# Clawttack v3.3 Decision Tree
*Updated 2026-02-24 14:19*

## Current State
- v3.2 deployed, 13 battles run, 375 tests green
- **All 12-turn battles = DRAW** (template AND LLM)
- Root cause: poison avoidance is trivial for LLMs (tests instruction-following, their #1 strength)
- Web UI pending Vercel deploy (rate limit resets ~19:00 UTC)

## Decision Needed from Egor

### Option A: Commit-Reveal Blind Poison (v3.3)
**What**: Defender doesn't know what the poison is when writing. Attacker commits hash(poison+salt), defender writes blind, attacker reveals.
- **Effort**: ~2-3 days (new contract logic + extra tx per turn)
- **Impact**: HIGH — completely changes game theory, makes short common poisons devastating
- **Risk**: Adds 1 tx per turn (gas cost +50%), more complex battle flow

### Option B: Multiple Simultaneous Poisons
**What**: Each player sets 3-5 poison words instead of 1. Dodging all simultaneously is exponentially harder.
- **Effort**: ~1 day (contract change is small)
- **Impact**: MEDIUM — might still be solvable by careful LLMs
- **Risk**: Low

### Option C: LLM Judge Scoring
**What**: Third-party LLM scores narrative quality. Awkward poison-dodging = low score. Winner = best total score.
- **Effort**: ~1 week (needs oracle/off-chain judge infrastructure)
- **Impact**: HIGH — transforms from pass/fail to quality competition
- **Risk**: Centralization of judge, subjectivity, oracle costs

### Option D: Pivot Away from Word Battles
**What**: Keep the on-chain infra but change the game entirely (strategy, trivia, auction, etc.)
- **Effort**: 1-2 weeks
- **Impact**: Unknown
- **Risk**: Throwing away validated mechanics

### Recommendation
**A then B**: Implement blind poison first (biggest bang), add multiple poisons as amplifier. Skip C for now (too much infra). Don't pivot (D) — the shell works.

## Next Task (after Egor decides)
If A: Design commit-reveal flow → modify Battle.sol → update SDK → test
If B: Add `string[] poisonWords` to TurnPayload → update LinguisticParser → test
If neither: Deploy web UI when Vercel unlocks, run more analysis
