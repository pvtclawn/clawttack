# PLAN.md — Clawttack V3 Next Steps (Updated 2026-02-24 02:34 UTC)

## Status: ALL 6 MECHANICS VERIFIED ✅ | P0+P1 FIXES DEPLOYED ✅ | 50 BATTLES ON-CHAIN

---

## ✅ COMPLETED (Overnight Feb 23-24)

| # | Item | Status |
|---|------|--------|
| 1 | P0 Poison boundary fix | ✅ Deployed (Option A — boundary checks mirror target logic) |
| 2 | P1 Timeout floor (MIN_TIMEOUT_FLOOR=10) | ✅ Deployed |
| 3 | P1 Stuck fund rescue (rescueStuckFunds) | ✅ Deployed |
| 4 | Red-team (7 weaknesses found) | ✅ Documented |
| 5 | All 6 battle mechanics verified | ✅ MaxTurns, Timeout, Poison, Elo, DrawConverge, Joker |
| 6 | New Battle impl deployed | ✅ `0x927B` on Base Sepolia |
| 7 | Full battle on new impl | ✅ Battle #50, 12 turns, settled |

**Deployed contracts:**
- Arena: `0x6045d9b8Ab1583AD4cEb600c0E8d515E9922d2eB` (unchanged)
- Battle Impl: `0x927B3644996710789fD8EFbfc623B194cF9f877c` (NEW — fixes)
- Word Dictionary: `0xa5bAC96F55e46563D0B0b57694E7Ac7Bc7DA25eC`
- HashPreimage VOP: `0xE75bE6a420bEAdCd722C57C44ac16AeF14a4012C`

**Test coverage:** 277 tests (75 Forge + 202 Bun), 0 failures.

---

## Priority Stack (for Egor discussion)

### 🟡 1. LLM Narrative Integration (THE Feature)
**What**: Replace template narratives with LLM-generated ones.
**Prompt**: "Write 200 chars about {word}. Do NOT use the word {poison}."
**Why #1**: Without this, all battles are draws. The competitive system is dormant. Poison boundary fix proves the security model works — now we need creative narratives to trigger it.
**Architecture**: Off-chain LLM call → narrative string → `submitTurn()`. No contract changes.
**Acceptance criteria**: Two agents play a full battle with unique narratives, at least one poison detection trigger.

### 🟡 2. Web UI Polish
**What**: Hook up to v3.1 addresses, multicall batch reads, live turn updates, narrative display.
**Blocked by**: More interesting with LLM narratives to show.

### 🟡 3. Fix test-poison-boundary.ts Script
**What**: Script hardcodes "abandon" as target word instead of reading actual `targetWordIndex` → `TargetWordMissing` revert. Quick fix.
**Note**: RPC strips custom error data from EIP-1167 delegatecall reverts → bare `0x` — misleading but harmless.

### 🟢 4. Agent Cleanup
**What**: 29+ agents registered from test runs. Consider `deregisterAgent()` or fresh deployment.

### 🟢 5. Remaining P2/P3 Weaknesses (from red-team)
- Elo non-zero-sum inflation (long-term, cosmetic)
- prevrandao first-mover manipulation (VRF upgrade path)
- No agent deregistration (state pollution)
- Draw refund rounding dust (1 wei, negligible)

---

## Overnight Session Stats
- **7 heartbeat lanes** executed (B, F, A, B, C, C, E)
- **50 battles** on Base Sepolia (39 old + 11 new impl)
- **3 contract fixes** deployed and verified
- **16 new Forge tests** (LinguisticParser boundary tests)
- **7 weaknesses** documented, 3 fixed
- **1 reading session** (Agentic AI Ch.9 — memory architecture)

---
*Updated by PrivateClawn. Morning briefing: `memory/2026-02-24.md`*
