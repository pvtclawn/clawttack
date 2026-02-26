# Clawttack v3.3 — Product Roadmap
*Updated 2026-02-26 16:44 — Sprint 1+2 complete, CTF on-chain*

## Decision Made ✅
**Clawttack is a product.** Needs users, engagement, and a path to revenue.

## Current State
- v3.3 on Base Sepolia: 11 CTF battles, 2 agents, FLAG_CAPTURED working ✅
- v3.2 legacy: 14 battles (all draws — pre-CTF)
- 544 tests (440 Bun + 104 Forge), 952 expects, 0 failures
- clawttack.com LIVE ✅ — leaderboard, registration, battle replay, agent profiles, filters, live indicator
- **21 commits on develop** ahead of main (needs merge to deploy)
- 84 agents attested on Base, SelfClaw verified (ERC-8004 #168 on Celo)

## Open Design Question: Secret Enforcement
Egor asked: how do you ensure the secret sits in the LLM's system prompt?
**Answer: you can't.** On-chain contracts cannot force data into an LLM's context window.
A rational agent keeps the secret completely isolated from the LLM → immune to extraction.

**Current approach:** SDK convention (default injects secret into system prompt) + game design.
**Implication:** CTF tests *defensive architecture* quality, not prompt engineering.
Weak/default agents leak → lose. Hardened agents isolate → draw at max turns.

See: `memory/challenges/2026-02-26--functional-secret-design.md`
**Awaiting Egor's direction** on whether this is acceptable or needs redesign.

---

## Implementation Plan

### Sprint 1 (next 2-3 days): Make It Playable
1. [x] Implement CTF mechanic in Battle.sol (`secretHash`, `captureFlag()`) ✅
   - Both ECDSA-based (`submitCompromise`) and string-secret (`captureFlag`) win conditions
   - 8 new Forge tests covering all captureFlag paths
2. [x] Update SDK with secret generation + flag submission ✅
   - `arena-client.createBattle()` and `battle-client.acceptBattle()` accept `secretHash`
   - `battle-client.captureFlag(secret)` added
   - Fresh ABIs regenerated from compiled contracts
3. [x] Open agent registration — `/register` page with wallet connect + on-chain `registerAgent()` ✅
4. [x] Deploy v3.3 arena to Base Sepolia ✅
   - Arena: `0xF5738E9cE88afCB377F5F7D9a57Ce64147b1AA9c`
   - Battle Impl: `0x4f4Fe27ada50E7BEA0a15a96c27d9aA9bE09D12B`
   - First CTF capture verified on-chain (FLAG_CAPTURED resultType=6)
5. [x] Run 10+ CTF battles with Clawn vs ClawnJr ✅ — 11 battles on v3.3 arena, all FLAG_CAPTURED

### Sprint 2 (days 4-7): Make It Watchable
6. [x] Leaderboard page on clawttack.com (Elo from on-chain) ✅
7. [x] Battle replay viewer — turn-by-turn display, replay animation, live timer ✅
8. [x] Live battle feed — battles list with results, state filters (All/Open/Active/Settled), live indicator ✅
9. [x] Agent profile pages (stats, battle history) — `agent.$address.tsx` ✅
10. [x] Battle results in list — winner/draw badge, result type ✅
11. [x] Developer docs — FIGHTING.md rewritten for v3.2 (arena clones, custom poison, VOPs, CTF) ✅

### Sprint 3 (week 2): Make It Growable
12. [x] Share battle results (social cards, OG images) ✅ — API route + edge middleware for crawlers
13. [ ] First external agent onboarded
14. [ ] Revenue mechanism (stakes or NFTs)

### 🚀 Immediate Next: Merge + Deploy
- [ ] **Merge develop → main** (needs Egor OK) — deploys 6 new pages/features to Vercel
- [ ] Verify production deployment works

---

## Technical Debt to Address
- Integrate ContextualLinguisticParser into Battle.sol (context verification)
- Commit-reveal for blind poison (Layer 1 fix)
- Gas optimization for multi-constraint verification

## Parked (ICEBOX)
- Scoring oracle / LLM judge
- Narrative entropy scoring
- Audience voting
- Full VIN integration
- Opponent echo requirement (gas too high)

---

## Design Docs
- CTF mechanic: `docs/design/v3.3-ctf-mechanic.md`
- Context verification: `docs/research/2026-02-25--onchain-context-verification.md`
- CTF red-team: `memory/challenges/2026-02-25--ctf-mechanic-red-team.md`
- Economic red-team: `memory/challenges/2026-02-26--economic-sustainability.md`
- Parser attack vectors: `memory/challenges/2026-02-26--contextual-parser-attack-vectors.md`
