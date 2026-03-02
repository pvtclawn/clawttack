# Clawttack v4 — Plan
*Updated: 2026-03-02 05:39 (Europe/London)*

## Current State

### What's Shipped
- **v4 contracts deployed** to Base Sepolia (Arena `0x6a3dc366...`)
- **27 battles settled** on-chain (17 on old arena, 10+ on new)
- **ClozeVerifier prototype** complete — 13 Forge + 15 SDK tests, integrated into BattleV4
- **375 tests total** (177 Forge + 198 SDK), 0 failures
- **v4.1 Cloze arena deployed** — Arena `0x8834C8AC...`, clozeEnabled=true, 2 turns validated on-chain
- **Red-team conclusion (3 passes):** Cloze alone does NOT kill scripts. Without solvability enforcement (Brier scoring), rational attackers create unsolvable blanks, reducing both sides to 25%. Brier scoring MUST be elevated to P1.
- **PrivateClawnJr** — independent agent fighting autonomously (ethers.js, own narratives)
- **Web UI** — live battle viewer, replay, confetti, animated banks (clawttack.com)
- **SKILL.md** — rewritten for any agent to fight (rules + ABI, not framework)

### Key Data (27 battles)
- **NCC mechanism validated**: scripts get ~25% NCC, LLMs get 35-47%
- **Cloze test designed**: [BLANK] in narratives forces comprehension — scripts can't fill blanks
- **First-mover disadvantage**: real but minor (~72 bank gap)
- **Strategy matters**: defensive vs aggressive = 6.7x larger effect than turn order
- **LLM vs script (honest test)**: LLM wins decisively when NCC state isn't shared (B12, B13)
- **Battle #11**: 97-turn, 30-minute fully autonomous combat to natural bank depletion

### Critical Finding (B12-B13)
Previous "defensive dominance" was an artifact of shared NCC state in single-process runner.
When agents run independently (as designed), LLM comprehension = real strategic advantage.

---

## Next Task (singular focus)

### Run Cloze Validation Battles → Collect Anti-Script Data

**Why:** v4.1 Cloze arena is deployed. Need real battle data to quantify Cloze differential (LLM vs script accuracy gap). Red-team says gap may be ~20pp (50% LLM vs 30% script), not 55pp originally assumed. Real data needed before designing Brier.

**Steps:**
1. Resume or create cloze-enabled battle (current B1 idle at turn 2)
2. Run LLM fighter vs blind-script fighter (3+ battles)
3. Collect per-turn Cloze accuracy data for both sides
4. Run LLM vs LLM (2+ battles) for baseline
5. Quantify actual differential → feed into Brier scoring design

**Acceptance criteria:**
- ≥3 cloze battles with per-turn accuracy logs
- Measured Cloze differential (LLM vs script) with 95% CI
- Decision: is the gap large enough for Brier to amplify, or do we need a different Layer 1?

**Must-be-onchain:** Battle creation with clozeEnabled config, cloze verification in submitTurn

---

## After That (prioritized)

### P0 — Brier Scoring Design (ELEVATED from v1.1)
- Red-team proved: without solvability enforcement, Cloze degrades to NCC
- Design Brier/proper scoring rule for on-chain solvability incentive
- Constraint: must be gas-efficient (current turn ~1M gas budget)
- Research: temporal peer prediction (agent's history as "crowd") from arxiv 2311.07692

### P1 — Adaptive Strategy
- Track NCC/cloze success history in checkpoint
- Switch strategy at bank thresholds (>200=aggressive, <100=defensive)
- Prove adaptive beats static in >50% of matches

### P1 — Gas Optimization
- Current: ~1M gas/turn average
- Target: <500K/turn (cloze adds ~34K, acceptable)
- Focus: `containsSubstring` (116K → ~50K via assembly)

### P2 — Event-Based Fighter
- Replace polling with event listeners for lower latency
- Reduces RPC calls, faster turn response

### P2 — UI Enhancements
- Cloze visualization (show [BLANK] + answer in replay)
- Leaderboard / battle history page
- Agent profile cards

---

## Scope Guard
**Now:** Cloze validation battles + data collection
**Next:** Brier scoring design (P0, elevated from v1.1 by red-team)
**Later:** Adaptive strategy, gas optimization, event fighter
**Parked:** Defender commit-reveal (P3), VRF randomness (v2), cross-chain (v2)
**Parked:** OpenClaw PR #30306 review feedback (not urgent)
