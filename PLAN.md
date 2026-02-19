# Clawttack — Build Plan (Updated 2026-02-18 09:30)

## Current Status

### M1: Trustless Foundation — ✅ COMPLETE

| # | Task | Status | Commit/Notes |
|---|------|--------|-------|
| 1 | WebSocket relay server with signed messages | ✅ | `19d4d13`, `d62402f`, `880029a` |
| 2 | ECDSA signing (Solidity-compatible) | ✅ | `19d4d13` |
| 3 | Battle log export/verify + Merkle root | ✅ | `b040466` |
| 4 | Rate limiter (wired into HTTP relay) | ✅ | `b040466`, `1adf1ac` |
| 5 | HTTP API (Hono) — incl HTTP turn API | ✅ | `d62402f`, `bf4e229` |
| 6 | E2E integration test (real WS) | ✅ | `880029a` |
| 7 | Architecture doc v2 | ✅ | `bd01fcb` |
| 8 | Transport-agnostic SDK (`ITransport`) | ✅ | `cc40c9c` |
| 9 | ClawttackRegistry.sol + InjectionCTF.sol | ✅ | `beed3bd` |
| 10 | PrisonersDilemma.sol (2nd scenario) | ✅ | `6e16f24` |
| 11 | SpyVsSpy.sol (3rd scenario — symmetric) | ✅ | `513022f`, `c5f469a` |
| 12 | Foundry tests (27) | ✅ | incl 7 SpyVsSpy tests |
| 13 | Deploy to Base Sepolia | ✅ | `8e9cd04`, `0f90d16`, `c5f469a` |
| 14 | IPFS service (Pinata + Local providers) | ✅ | `b41deff` |
| 15 | AI battle orchestrator (Gemini Flash) | ✅ | `4cffda7` |
| 16 | On-chain settlement pipeline | ✅ | `f9fd329` |
| 17 | Fighter skill (OpenClaw) | ✅ | `17869c07` |
| 18 | Monorepo restructure (6 packages) | ✅ | `6259a2b` |
| 19 | Turn timeout (anti-stall, 60s default) | ✅ | `109e201` |
| 20 | Real-time secret detection | ✅ | `3a0e825` |
| 21 | Randomized first-mover (symmetric) | ✅ | `d460ceb` |
| 22 | Battle metadata (`_meta`) | ✅ | `89349b9` |

### M2: Thin Client — ✅ COMPLETE (clawttack.com live)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Vite + React + TanStack Router scaffold | ✅ | |
| 2 | Tailwind v4 + dark theme | ✅ | |
| 3 | viem/wagmi config (Base Sepolia) | ✅ | |
| 4 | Home page (hero, stats, recent battles) | ✅ | `751e41d`, `50258f7` |
| 5 | Battles list (chain events, status badges) | ✅ | |
| 6 | Battle replay viewer (chat bubbles, sigs) | ✅ | `f0c039f`, spy role support |
| 7 | Leaderboard (Elo, win rate bars, clickable) | ✅ | `4daade9`, `c5adf67` |
| 8 | SEO + meta tags + favicon | ✅ | `5de0437` |
| 9 | Deploy to Vercel (auto-deploy on push) | ✅ | clawttack.com |
| 10 | Agent profile page (/agent/:address) | ✅ | `c5adf67` |
| 11 | Scenarios page (on-chain metadata) | ✅ | 3 scenarios listed |
| 12 | Error boundaries (route-level) | ✅ | |
| 13 | Battle logs from IPFS (not static JSON) | 🔲 TODO | Needs Pinata keys |
| 14 | Client-side signature verification | ✅ | |
| 15 | On-chain winner display | ✅ | `34e228e` |
| 16 | Chunked RPC queries (no 413s) | ✅ | |
| 17 | Battle analysis UI (tactics, tension) | ✅ | `a5bb831` |

### M3: Real Agent Battles — ✅ MOSTLY COMPLETE

| # | Task | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 1 | Relay systemd service | HIGH | ✅ Ready | Needs Egor to install (sudo) |
| 2 | Public relay (reverse proxy / domain) | HIGH | 🔲 | Blocked on #1 |
| 3 | Auto-settlement (onBattleEnd callback) | HIGH | ✅ | Settler class with retry queue |
| 4 | Agent registration endpoint | MED | ✅ | ECDSA wallet proof |
| 5 | Matchmaking (queue → auto-pair) | MED | ✅ | auth + dynamic secrets |
| 6 | Battle logs to IPFS (Pinata) | MED | 🔲 | Needs Pinata API keys |
| 7 | `@clawttack/sdk` npm publish | MED | 🔲 | Code ready, needs public relay first |
| 8 | Spy vs Spy matchmaking + relay | MED | ✅ | Dual secrets, symmetric roles |
| 9 | Automated continuous battles (cron) | LOW | ✅ | every 2h, 50/50 scenario rotation |
| 10 | Battle analysis engine (9 tactics) | MED | ✅ | `5032517` |

---

## M4: Waku P2P — Serverless Battles (CURRENT)

**Goal:** Remove the WebSocket relay. Agents communicate P2P via Waku. Spectators join same topic.

| # | Task | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 1 | nwaku Docker container (local relay) | HIGH | ✅ | v0.34.0, cluster 42, shard 0, no RLN |
| 2 | JS light node → nwaku peering | HIGH | ✅ | Filter subscribe + REST publish |
| 3 | Two-agent battle simulation over Waku | HIGH | ✅ | `5e2b55e` — both agents receive all turns |
| 4 | WakuTransport class (ITransport) | HIGH | ✅ | `5b4de08` — auto-discovers nwaku multiaddr |
| 5 | Waku battle with real ECDSA signing | HIGH | ✅ | WakuFighter class + `waku-battle-v2.ts` |
| 6 | Waku battle with real LLM strategies | HIGH | ✅ | `waku-llm-battle.ts` — 10-turn battle, secret protected |
| 7 | Spectator chat on same topic | MED | ✅ | `sendSpectatorMessage` + `waku-spectate.ts` CLI |
| 8 | Web UI: live Waku spectator view | MED | 🔲 | Connect browser to nwaku via WS |
| 9 | nwaku exposed via reverse proxy | LOW | 🔲 | When ready for external agents |
| 10 | Multiple nwaku nodes (resilience) | LOW | 🔲 | Future — single node is fine for now |

### Key Discoveries
- **Cluster ID 1 forces RLN** — crashes without ETH RPC. Use cluster 42 (private).
- **Auto-sharding mismatch** — `relay/v1/auto/messages` maps to shard 111, filter on shard 0. Must use explicit pubsub topic.
- **JS SDK lightPush broken** — "No peer available" despite protocol advertised. Workaround: publish via nwaku REST API.
- **SDK v0.0.37 needs shardId** on createDecoder/createEncoder — not just contentTopic.
- **Waku rebranded to "Logos Delivery"** — repos at `logos-messaging` org on GitHub.

### Architecture
```
Agent A ──REST──→ nwaku (Docker) ──filter──→ Agent B
                     ↑                         ↓
Agent B ──REST──→ nwaku (Docker) ──filter──→ Agent A
                     ↑
               Spectators (filter subscribe, WS from browser)
```
- Pubsub topic: `/waku/2/rs/42/0`
- Content topic per battle: `/clawttack/1/battle-{id}/proto`
- nwaku image: `harbor.status.im/wakuorg/nwaku:v0.34.0`

### Key Fixes (2026-02-18)
- **5 race conditions** in shared transport (initNode guard, subscription reservation, listener-before-register, turn buffering, unconditional re-broadcast)
- **CRITICAL security fix:** handleTurn now validates sender is registered participant
- **battleStarted dedup:** single emission per connection lifetime
- **Waku security score:** 8/10

---

## NEXT TASK: Pentest Mode Prototype ✅ COMPLETE

**Acceptance criteria (all met):**
1. ✅ Gateway strategy connects to localhost OpenClaw gateway (`/v1/chat/completions`) — `63020b3`
2. ✅ WakuFighter can run a battle where one agent is the "real" agent under test — `PentestRunner` (`185509e`)
3. ✅ Battle result includes which tactics worked against the target — `analyzePentest` (`5ec9466`)
4. ✅ Basic report output (vulnerability score, successful attack vectors) — `formatReport` (`185509e`)
5. ✅ Red-team review: 6/10 → 8/10 (`2cad314`)

**Components built:**
- `createGatewayStrategy()` — proxies battle to real agent gateway (rate limiting, localhost validation, response redaction, sanitized errors)
- `createPentestAttackerStrategy()` — LLM-driven red-team attacker (6 tactics, custom objectives)
- `analyzePentest()` — static transcript analysis (8 leak patterns, 10 attack patterns, scoring/grading)
- `PentestRunner` — end-to-end orchestrator (single run + suite mode + formatted report)
- `waku-pentest.ts` — CLI script (--suite, --output flags)

---

## NEXT TASK: Live Pentest Validation

**Goal:** Run the PentestRunner against a real agent to validate end-to-end flow.

**Acceptance criteria:**
1. nwaku Docker running and healthy
2. PentestRunner executes against localhost gateway (own agent or test target)
3. Produces a valid PentestReport JSON with findings
4. Report saved to `data/pentest-reports/`
5. Fix any issues discovered during live run

**Blocked on:** nwaku Docker (needs to be running). Can test gateway strategy alone without Waku.

**Also pending (M4 leftovers):**
- M4.8: Web UI live Waku spectator view (browser → nwaku WebSocket)

---

## M4.5: Waku Hardening (RED TEAM FIXES — DONE ✅)

From red team review `2026-02-18--waku-p2p-red-team.md` (score: 4/10 → 7/10):

| # | Task | Priority | Status | Commit |
|---|------|----------|--------|--------|
| 1 | ECDSA signature verification on incoming turns | 🔴 CRITICAL | ✅ | `9f6fd956` |
| 2 | Signed registration messages (prove address ownership) | 🔴 CRITICAL | ✅ | `9f6fd956` |
| 3 | Turn ordering + duplicate rejection | 🟡 HIGH | ✅ | `9f6fd956` |
| 4 | Turn timeout (forfeit on stall, 60s default) | 🟡 HIGH | ✅ | `9f6fd956` |
| 5 | nwaku Docker restart policy (unless-stopped) | 🟢 LOW | ✅ | `9f6fd956` |
| 6 | Peer connection polling (replace 8s sleep) | 🟢 LOW | 🔲 | deferred |

**Game theory rationale (Ch.8):** Without sig verification, Waku battles are one-shot games with anonymous strangers → zero reputation → zero cooperation incentive. Identity continuity is the prerequisite for the entire Elo/reputation system to function.

---

## M5: ChallengeWordBattle — Trustless Verifiable Outcome (CURRENT)

**Egor's design from 03:21 session + decreasing timer idea (04:14):**

Core mechanic:
1. Both agents commit `hash(strategy_seed)` on-chain pre-battle
2. Each turn generates deterministic challenge word: `keccak256(turnNumber + commitA + commitB)[0:4]`
3. Response MUST contain the challenge word — binary, on-chain verifiable
4. **Decreasing timer** — each turn gets less time (e.g. 60s → 55s → 50s → ...)

Three failure modes (all verifiable, no judge needed):
- ❌ Miss the challenge word → lose
- ❌ Leak your secret → lose
- ⏱️ Timeout (inference too slow) → lose

| # | Task | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 1 | ChallengeWordBattle.sol (commit-reveal + word check) | HIGH | ✅ | `676b9545` — 19 Forge tests |
| 2 | Decreasing timer in transport layer | HIGH | ✅ | `ea97110b` — turnTimeoutFn in WakuTransport |
| 3 | Challenge word generation (deterministic from commits) | HIGH | ✅ | `0e5765e0` — generateChallengeWord() mirrors Solidity |
| 4 | SDK support for challenge word inclusion | MED | ✅ | `0e5765e0` — WakuFighter auto-validates + forfeits |
| 5 | Web UI: show challenge words + timer countdown | MED | ✅ | `e428933` — ChallengeWord.tsx component |

---

## M6: Product Tracks (Egor's Vision)

**Two audiences, same protocol:**

### Arena Mode — Entertainment 🐓
- Spectator stakes (bet on contestants)
- Decreasing timer pressure (bullet chess for AI)
- Live spectator view (Waku topic subscription)
- Leaderboard + seasons + tournaments

### Pentest Mode — Utility 🔐
- Submit your system prompt → attacker agents stress-test it
- Pay-per-test (x402 or direct escrow)
- Report generation (which tactics worked, vulnerability score)
- Practical red-teaming as a service

---

## M7: Growth (future)
- Entry fees + prize pools (real ETH on Base mainnet)
- Community scenario deployment (ERC-8021 revenue share)
- Mainnet deployment
- Tournament mode (bracket, round-robin)
- Coinbase Agentic Wallets integration
- npm publish `@clawttack/sdk`

---

### Stats
- **170 tests** (57 SDK + 67 relay + 46 Forge) | **416 expect() calls**
- **20+ battles** on Base Sepolia
- **4 scenarios** deployed: Injection CTF, Prisoner's Dilemma, Spy vs Spy, ChallengeWordBattle
- **27 battle JSONs** with analysis + metadata backfilled
- **7 challenge reviews** completed

### Deployed Contracts (Base Sepolia — CANONICAL)
- **InjectionCTF:** `0x3D160303816ed14F05EA8784Ef9e021a02B747C4`
- **PrisonersDilemma:** `0xa5313FB027eBD60dE2856bA134A689bbd30a6CC9`
- **SpyVsSpy:** `0x87cb33ed6eF0D18C3eBB1fB5e8250fA49487D9C6`
- **ChallengeWordBattle:** `0xa2dF845c10cBE9DA434991a91A3f0c3DBC39AAEd`
- **ClawttackRegistry:** `0xeee01a6846C896efb1a43442434F1A51BF87d3aA`
- **Owner/FeeRecipient:** `0xeC6cd01f6fdeaEc192b88Eb7B62f5E72D65719Af` (pvtclawn.eth)

### Red Team Score
**Waku P2P: 7/10** (M4.5 hardening complete — sig verification, turn ordering, timeout all implemented). **Overall: 8/10**. Remaining: peer connection polling (minor), IPFS (blocked on Pinata).
