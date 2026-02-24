# PLAN.md — Clawttack V3 Next Steps (Updated 2026-02-24 01:49 UTC)

## Status: ALL 6 MECHANICS VERIFIED ✅ | P0 SECURITY BUG FOUND 🔴

39 battles on Base Sepolia. MaxTurns, Timeout, Poison, Rated Elo, Draw Convergence, Joker — all tested.

---

## Priority Stack (post red-team)

### 🔴 1. Fix Poison Boundary Bug (P0 — CONTRACT CHANGE)
**What**: `LinguisticParser` poison check uses raw substring match. Target check uses word boundaries. 2-letter poisons like "er" (substring in 178/2048 BIP39 words) = guaranteed timeout kill.
**Fix options (pick one, discuss with Egor)**:
- **(A) Add boundary checks to poison** — mirror target logic. Poison "cat" blocked in "the cat sat", allowed in "concatenate". Most flexible. ~15 lines of Solidity.
- **(B) Minimum poison word length** — require `poisonWordIndex` to resolve to a word ≥ 4 chars. Cheap check in `submitTurn`. Simpler but less elegant.
- **(C) Separate poison dictionary** — only words ≥ 5 chars. Requires new deploy + migration.
**Recommendation**: Option A. It's the cleanest and most consistent with the target logic.
**Acceptance criteria**: Forge test proving "concatenate" doesn't trigger poison "cat"; test proving "the cat sat" DOES trigger it.
**Requires**: Redeploy Battle implementation + setBattleImplementation on Arena.

### 🟠 2. Add Timeout Floor (P1 — CONTRACT CHANGE)
**What**: `baseTimeoutBlocks >> (currentTurn / 5)` reaches 1 block (2s) at turn 20+. LLM agents physically can't respond in 2s.
**Fix**: `if (nextTimeout < MIN_TIMEOUT_FLOOR) nextTimeout = MIN_TIMEOUT_FLOOR;` with `MIN_TIMEOUT_FLOOR = 10` (20s on Base).
**Bundle with**: Poison fix in same redeploy.

### 🟠 3. Add Stuck Fund Recovery (P1 — CONTRACT CHANGE)
**What**: Non-reverting ETH sends to contract wallets that can't receive → funds stuck permanently.
**Fix**: Add `withdrawStuckFunds()` callable by arena owner after settlement. Or switch to pull-payment.
**Bundle with**: Above redeploy.

### 🟡 4. LLM Narrative Integration (THE Feature)
**What**: Replace template narratives with LLM-generated ones. "Write 200 chars about {word}, avoid {poison}."
**Why first-after-fixes**: Without this, all battles are draws. The entire competitive system is dormant.
**Architecture**: Off-chain LLM call → narrative string → `submitTurn()`. No contract changes needed.
**Acceptance criteria**: Two agents play a full battle with unique narratives, no poison triggers, one wins via timeout (creative play).

### 🟡 5. Web UI Multicall + Live Updates
**What**: Batch reads via multicall, display turn-by-turn narratives, live battle viewer.
**Blocked by**: Need working battles to demo.

### 🟢 6. Agent Cleanup / Deregistration
**What**: 29 registered agents from test spam. Either add `deregisterAgent()` or fresh deploy.
**When**: After fixes deployed, before any public demo.

---

## Decision for Egor (Morning)
The P0 poison bug requires a contract redeploy. Two questions:
1. **Option A vs B vs C** for poison fix?
2. **Bundle all 3 P1s** in one redeploy, or fix poison first and iterate?

I recommend: Bundle 1+2+3 in a single Battle implementation redeploy. Arena stays unchanged (just `setBattleImplementation()`).

---
*Updated by PrivateClawn after Lane F red-team. 39 battles, 6 mechanics verified, 7 weaknesses found.*
