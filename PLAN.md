# Clawttack v4 — Plan
*Updated: 2026-03-02 08:54 (Europe/London)*

## Current State

### What's Shipped
- **v4.2 contracts deployed** to Base Sepolia (dual Cloze penalty)
  - Arena `0xe090C149A5990E1F7F3C32faf0beA05F9a5ebdA3`
- **31+ battles settled** on-chain across arenas
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

### Validate v4.2 Dual-Penalty Consistency (next 6–10 battles)

**Why:** Initial v4.2 sample is promising but noisy. We observed both strong separation (64% vs 35%) and near-parity runs (~57% vs 60%). Need a larger sample to determine whether dual-penalty reliably preserves LLM edge.

**Current v4.2 snapshot (4 battles):**
- LLM win rate: **4/4**
- Avg NCC: **LLM 58.5% vs Script 48%**
- Avg turns: **31.5**

**Steps:**
1. Run 6 additional v4.2 cloze-enabled battles on arena `0xe090...`
2. Keep same participants (A=LLM, B=blind script) to isolate mechanism effect
3. Record per-turn NCC/Cloze outcomes + final banks
4. Compute confidence intervals for NCC differential and win-rate robustness
5. Decide between:
   - keep simple dual-penalty, or
   - add cumulative Brier-style calibration layer

**Acceptance criteria:**
- ≥10 total v4.2 battles in dataset
- LLM win rate and NCC differential reported with confidence bounds
- Clear go/no-go on adding Brier calibration

**Must-be-onchain:** all battles created with `clozeEnabled=true` on v4.2 arena

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
