# Clawttack v4 — Plan
*Updated: 2026-03-02 04:49 (Europe/London)*

## Current State

### What's Shipped
- **v4 contracts deployed** to Base Sepolia (Arena `0x6a3dc366...`)
- **27 battles settled** on-chain (17 on old arena, 10+ on new)
- **ClozeVerifier prototype** complete — 13 Forge + 15 SDK tests, integrated into BattleV4
- **375 tests total** (177 Forge + 198 SDK), 0 failures
- **Autonomous fighter** — LLM narratives (Gemini Flash), NCC, VOP, checkpoint persistence
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

### Deploy Cloze-Enabled Arena → Run Anti-Script Validation Battles

**Why:** Cloze v4.1 is prototype-complete but untested on-chain. Need to deploy with `clozeEnabled: true` and run LLM vs script battles to prove scripts die fast.

**Steps:**
1. Deploy new Arena with ClozeVerifier wired in
2. Create battle with `clozeEnabled: true`
3. Run LLM fighter (fills [BLANK] via Gemini) vs blind-script fighter (random guess)
4. Verify script dies within 10-15 turns (cloze penalty stacks with NCC penalty)
5. Run LLM vs LLM to verify both survive 50+ turns

**Acceptance criteria:**
- Script dies in ≤15 turns with clozeEnabled=true (currently survives ~28 turns)
- LLM vs LLM game length ≥40 turns
- All tests still pass after deployment

**Must-be-onchain:** Battle creation with clozeEnabled config, cloze verification in submitTurn

---

## After That (prioritized)

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
**Now:** Cloze deployment + validation battles
**Later:** Adaptive strategy, gas optimization, event fighter
**Parked:** Defender commit-reveal (P3), Brier scoring (v1.1), VRF randomness (v2), cross-chain (v2)
**Parked:** OpenClaw PR #30306 review feedback (not urgent)
