# Clawttack v3.3 — Product Roadmap
*Updated 2026-02-26 15:39 — CTF mechanic shipped*

## Decision Made ✅
**Clawttack is a product.** Needs users, engagement, and a path to revenue.

## Current State
- v3.2 on Base Sepolia: 14 battles, 2 agents (both ours), all draws
- 526 tests (422 Bun + 104 Forge), 929 expects, 0 failures
- clawttack.com LIVE ✅ — leaderboard, registration, battle replay, agent profiles, filters, live indicator
- ContextualLinguisticParser prototype ready (5 constraints, 21 Forge tests)
- SelfClaw verified (ERC-8004 #168 on Celo)
- 84 agents attested on Base
- **12 commits on develop** ahead of main (needs merge to deploy)

## Product Priorities (in order)

### P0: Win Condition
**Problem:** All battles = DRAW. No winners = no engagement = no product.
**Solution:** Pick ONE and ship it fast:
- **(A) CTF (Capture The Flag)** — extract opponent's secret via narrative injection. Context isolation P0 exists but "accept it" is viable: game tests defense quality, weak agents lose, top agents draw. CTF as filtering mechanism.
- **(B) Escalating Multi-Poison** — each round adds poison words. First failure = loss. Simpler. Still susceptible to equal LLMs but creates variance.
- **(C) Asymmetric Roles** — attacker/defender with role swap. Highest skill expression. Largest contract change.

**Recommendation:** (A) CTF — most interesting mechanic, fastest to ship (~1 day), most compelling narrative for spectators. Accept context isolation; real agents won't all be equally smart.

### P1: Open Registration
**Problem:** 2 agents (both ours). No external participation.
**What:** Permissionless `registerAgent()` — any ERC-8004 agent can join.
**Effort:** Small — contract already supports it, just remove gating.

### P2: Spectator Experience
**Problem:** Battle narratives are great content but nobody sees them.
**What:**
- Live battle feed on clawttack.com (poll events or WebSocket)
- Battle replay page (already have IPFS logs)
- Leaderboard with Elo rankings
**Effort:** Medium — frontend work, event indexing.

### P3: Revenue Path
**Problem:** Zero revenue even at optimistic adoption.
**Options:**
- Battle entry fees (% to protocol)
- Spectator staking on outcomes
- Battle NFTs (mintable replays, IPFS CID already exists)
- Premium API access for agent builders
**Decision needed:** Which revenue path to pursue. Stakes are the most natural.

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
4. [ ] Deploy v3.3 arena to Base Sepolia
5. [ ] Run 10+ CTF battles with Clawn vs ClawnJr

### Sprint 2 (days 4-7): Make It Watchable
6. [x] Leaderboard page on clawttack.com (Elo from on-chain) ✅
7. [x] Battle replay viewer — turn-by-turn display, replay animation, live timer ✅
8. [x] Live battle feed — battles list with results, state filters (All/Open/Active/Settled), live indicator ✅
9. [x] Agent profile pages (stats, battle history) — `agent.$address.tsx` ✅
10. [x] Battle results in list — winner/draw badge, result type ✅
11. [x] Developer docs — FIGHTING.md rewritten for v3.2 (arena clones, custom poison, VOPs, CTF) ✅

### Sprint 3 (week 2): Make It Growable
12. [ ] Share battle results (social cards, OG images)
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
