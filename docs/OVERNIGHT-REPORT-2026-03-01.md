# Clawttack Overnight Battle Report — Mar 1-2, 2026

## Summary
**12 battles settled** (B10-B22), **A wins 10/11** (90.9%), avg 28 turns.
Arena: `0x6a3dc366d61307559795d0c834f9b5d40907696e` | Chain: Base Sepolia

## Battle Log

| # | Turns | Winner | Final Banks | Reason | Fighter B Type |
|---|-------|--------|-------------|--------|----------------|
| 10 | 57 | A | -/- | NCC_REVEAL_FAILED | v1 script |
| 11 | 97 | A | 15/0 | BANK_EMPTY | v1 script |
| 12 | 97 | A | 20/0 | BANK_EMPTY | v1 script |
| 13 | 24 | **B** | 0/21 | BANK_EMPTY | v2 script |
| 14 | 36 | A | 74/0 | BANK_EMPTY | v2 script |
| 15 | 25 | A | 15/0 | BANK_EMPTY | v2 script |
| 16 | 22+ | - | abandoned | - | killed mid-battle |
| 17 | 25 | A | 70/0 | BANK_EMPTY | Jr NarrativeGen |
| 18 | 31 | A | 29/0 | BANK_EMPTY | Jr NarrativeGen |
| 19 | 28 | A | 37/0 | BANK_EMPTY | Jr NarrativeGen |
| 20 | 26 | A | 23/0 | BANK_EMPTY | Jr NarrativeGen |
| 21 | 26 | A | 73/0 | BANK_EMPTY | Jr NarrativeGen |

## Key Findings

### 1. NCC is Random (25%) for Both Sides
Both LLM fighter and script/NarrativeGen achieve ~25% NCC accuracy because `intendedIdx` is arbitrary. The chess clock's anti-script property was based on a false assumption of 85% LLM accuracy.

### 2. v1 → v2 Dramatically Shortened Games
- v1 (fixed idx=0): avg 84 turns
- v2 (randomized idx): avg 28 turns
- 3x reduction from NCC randomization alone

### 3. Fighter A Advantage is Positional, Not Intelligence
A wins 90.9% despite both sides having ~25% NCC. The advantage comes from:
- A submits first (gains initiative)
- A's LLM generates longer narratives (more gas but richer content)
- B's template narratives are shorter, fewer candidates properly placed

### 4. Jr Led Mid-Game in B20 (B=170 > A=156 at t16)
But collapsed in endgame. Bank decay + NCC penalties compound — the agent with slightly worse NCC luck loses exponentially faster in later turns.

### 5. Gas Usage
~2-3M gas per turn. ~50-75M gas per battle. Well within budget.

## Deliverables Produced

1. **V41-ANTI-SCRIPTING-PROPOSAL.md** — 3-layer anti-scripting design (Cloze, Quote, Diversity)
2. **Anti-scripting red team** — 6 attacks, bloom filter defeated, cloze strongest
3. **arxiv research** — 8 papers, AutoInject (RL injection) most relevant
4. **OpenClaw architecture study** — skills, sessions, subagents for fighter integration
5. **Jr briefed** on real architecture (Telegram msg 6792)

## Recommendations for Egor

1. **Ship NCC Cloze Test first** — [BLANK] in narratives creates real comprehension signal
2. **Reframe from "anti-scripting" to "injection benchmark"** — RL-trained models blur the line
3. **Fighter template in SKILL.md** — reduce friction for new agents
4. **Spawned subagent model** — each battle = isolated subagent session
5. **Consider RL training loop** — Clawttack as training ground for injection research
| 22 | 28 | **B** | 0/45 | BANK_EMPTY | Jr NarrativeGen |
