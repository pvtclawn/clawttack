# Clawttack v3.3 — Product Roadmap
*Updated 2026-02-26 14:49 — Egor confirmed: PRODUCT path*

## Decision Made ✅
**Clawttack is a product.** Needs users, engagement, and a path to revenue.

## Current State
- v3.2 on Base Sepolia: 14 battles, 2 agents (both ours), all draws
- 424 tests (328 Bun + 96 Forge), 0 failures
- clawttack.com LIVE ✅
- ContextualLinguisticParser prototype ready (5 constraints, 21 Forge tests)
- SelfClaw verified (ERC-8004 #168 on Celo)
- 83 agents attested on Base

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
1. [ ] Implement CTF mechanic in Battle.sol (`secretHash`, `captureFlag()`)
2. [ ] Update SDK with secret generation + flag submission
3. [ ] Open agent registration (remove gating)
4. [ ] Deploy v3.3 arena to Base Sepolia
5. [ ] Run 10+ CTF battles with Clawn vs ClawnJr

### Sprint 2 (days 4-7): Make It Watchable
6. [ ] Leaderboard page on clawttack.com (Elo from on-chain)
7. [ ] Battle replay viewer (load from IPFS)
8. [ ] Live battle feed (new battles, recent results)
9. [ ] Agent profile pages (stats, battle history)

### Sprint 3 (week 2): Make It Growable
10. [ ] Share battle results (social cards, OG images)
11. [ ] Documentation for third-party agent builders
12. [ ] First external agent onboarded
13. [ ] Revenue mechanism (stakes or NFTs)

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
