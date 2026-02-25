# Clawttack v3.3 Decision Tree
*Updated 2026-02-25 04:14*

## Current State
- v3.2 deployed on Base Sepolia, 13 battles run (3 LLM), 375 tests green
- clawttack.com LIVE on Vercel ✅
- **All 12-turn battles = DRAW** (template AND LLM)
- Root cause: two layers deep (see below)

## The Two-Layer Problem

### Layer 1: Poison avoidance is trivial for LLMs
Poison is visible in TurnPayload event → agent reads it → explicitly instructs LLM to exclude → 100% success rate. Commit-reveal would fix this.

### Layer 2 (DEEPER): No win condition besides timeout
Even if poison becomes harder, **if both agents survive all turns → DRAW**. Two equally-capable LLM agents will always tie. The game has no way to determine a winner when both agents are competent.

**Layer 2 must be solved first.** Harder poison without a win condition just makes battles more frustrating, not more interesting.

## Proposed Architecture: Asymmetric Attacker/Defender

**Key insight from Lane F red-team (2026-02-25):** The game needs asymmetry.

### How it works
1. Battle has 2 halves (or alternating rounds)
2. **Attacker role**: Tries to make opponent's LLM fail (via poison, prompt injection, context manipulation)
3. **Defender role**: Tries to survive (produce valid narrative under constraints)
4. Agents swap roles each turn (or each half)
5. **First agent whose turn fails = LOSES**

### Why this works
- Draws still possible but rare (both survive all rounds = still a draw, but pressure escalates)
- Creates genuine strategy: attack strength vs defense robustness
- On-chain native: no oracle, no off-chain scoring
- Compatible with all existing mechanics (poison, VOP, proof-of-context)

### Variant: Escalating Difficulty
Each round, difficulty increases:
- Turn 1-4: 1 poison word, easy VOP
- Turn 5-8: 2 poison words, medium VOP
- Turn 9-12: 3 poison words, hard VOP + commit-reveal
First failure = loss. Survivors draw (rare at high difficulty).

## Decision Needed from Egor

### Option A: Asymmetric Roles (NEW — recommended)
**What**: Structured attacker/defender with role swapping.
- **Effort**: ~2-3 days (contract changes moderate, SDK changes significant)
- **Impact**: VERY HIGH — creates actual winners
- **Risk**: Larger contract change, needs careful game theory analysis

### Option B: Commit-Reveal Blind Poison
**What**: Defender doesn't know poison when writing.
- **Effort**: ~2-3 days
- **Impact**: HIGH for poison difficulty, but doesn't solve draws alone
- **Risk**: Adds 1 tx/turn, reveal griefing needs handling

### Option C: Escalating Multi-Poison (A-lite)
**What**: Each round adds more poison words. First failure = loss.
- **Effort**: ~1-2 days
- **Impact**: MEDIUM-HIGH — creates winners via difficulty ramp, simpler than full asymmetry
- **Risk**: Still susceptible to equally-capable LLMs both surviving

### Option D: Scoring Oracle (defer)
**What**: LLM judge scores narrative quality. Best score wins.
- **Effort**: ~1 week
- **Impact**: HIGH — real quality competition
- **Risk**: Centralization, cost, subjectivity. Defer unless A/C fail.

### Recommendation
**C first, then A**: Escalating multi-poison is simplest path to decisive outcomes. If both agents still survive at max difficulty, then full asymmetric roles (A) are needed. Skip D for now.

## Next Task (after Egor decides)
If C: Add `string[] poisonWords` to TurnPayload + escalation curve in contract + "first failure = loss" settlement
If A: Design attacker/defender role struct + swap logic + asymmetric turn validation
If B: Commit-reveal flow (can combine with C)
If none decided yet: Continue analysis, run more LLM battles, document findings

## Parked (ICEBOX)
- Multiple simultaneous VOP types per turn
- Narrative entropy scoring (on-chain uniqueness check)
- Audience voting / staking
- Opponent echo requirement (gas too high)
- Full VIN integration for proof-of-LLM-input
