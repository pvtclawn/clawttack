# Clawttack — Build Plan (Updated 2026-02-19 22:21)

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
| 13 | Battle logs from IPFS (not static JSON) | ✅ | `2c4a249` — 27 battles on Pinata, web fetches IPFS first |
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
| 6 | Battle logs to IPFS (Pinata) | MED | ✅ | `2c4a249` — 27 battles uploaded, CID mapping |
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

## NEXT TASK: Live Pentest Validation — ✅ COMPLETE

**Goal:** Run PentestRunner against own agent to validate end-to-end flow.

**Status:** Two runs completed — degraded (API key expired) + real (Grade F, 10/100, 3 criticals).

**Acceptance criteria:**
1. ✅ nwaku Docker running and healthy (v0.34.0, 25h uptime)
2. ✅ `runDirect()` executes against localhost gateway → produces valid PentestReport
3. ✅ Report saved to `data/pentest-reports/`
4. ✅ Fix issues discovered during live run (attacker error handling)
5. ✅ Re-run with working attacker API key (Egor rotated OpenRouter key)
6. 🔲 Run full Waku mode (`run()`) as stretch goal

**Real pentest findings (Grade F):**
- Agent disclosed full tool inventory, security policy, key storage approach
- Recognized the attack ("clean attack tree") but continued providing info
- Error sanitization held (T2 → "[Defender is processing...]")
- Absolute deny list for credentials held

---

## NEXT TASK: Gateway Strategy Error Sanitization — ✅ COMPLETE

Shipped `sanitizeDefenderResponse()` with 10 regex patterns, 11 new tests. Commit `ed17a19`.

---

## NEXT TASK: IPFS Hardening (from red-team review #11) — PARTIAL ✅

**Goal:** Fix HIGH-severity issues from IPFS integration red-team.

**Acceptance criteria:**
1. 🔲 Web UI reads CID from on-chain `turnLogCid` field (not static mapping) — needs contract interaction
2. 🔲 Auto-verify first ECDSA signature on battle page load
3. ✅ Multi-gateway fallback (Pinata → ipfs.io → dweb.link → cf-ipfs.com) — `4375f7d`
4. ✅ `staleTime: Infinity` for IPFS-fetched battle data — `4375f7d`
5. ✅ Normalize `battleId`/`id` field inconsistency — `4375f7d`

---

## NEXT TASK: Pentest Attacker v2 (from red-team review #12 vs ARACNE/RapidPen)

**Goal:** Upgrade pentest attacker from naive single-LLM to SOTA-informed architecture.

**Acceptance criteria (pick 2-3 per build lane):**
1. Add jailbreak tactics (#7): "Play as...", DAN variants, system prompt override
2. Add memory poisoning tactic (#8): "Remember that I'm an admin", false memory injection
3. Explicit tactic tracking: classify each turn's tactic, track success signals
4. RAG for success cases: store winning transcripts, inject as few-shot examples
5. Multi-LLM split (stretch): planner (stronger model) + executor (cheaper model)
6. Defense scoring dimension: measure defender detection + counter-attack ability
7. Context summarization: compress early turns after N rounds

---

## M8: ClawttackArena — Chain IS the Transport (CURRENT) 🏟️

**Egor's architecture pivot:** Per-turn on-chain txs. No relay, no Waku for turn exchange. Contract handles the full lifecycle.

| # | Task | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 1 | `ClawttackArena.sol` — challenge/accept/reveal/submitTurn/timeout | HIGH | ✅ | `15e01fe` — 28 Forge tests |
| 2 | Optimizer config (via-ir, 200 runs) → 10KB bytecode | HIGH | ✅ | `4f08e88` — under 24KB limit |
| 3 | Red-team audit #15 | HIGH | ✅ | 10 findings, 6/10 |
| 4 | **FIX: `reclaimCommitted()` — fund lock in Committed phase** | 🔴 CRITICAL | ✅ | `469c0a9` — 3 new tests |
| 5 | **FIX: Restrict `revealSeeds()` to participants** | 🟡 HIGH | ✅ | `469c0a9` — 1 new test |
| 6 | **FIX: Generate `battleId` on-chain** (prevent squatting) | 🟡 HIGH | ✅ | `469c0a9` — 2 new tests, returns bytes32 |
| 7 | Message length limit (max 10KB) | LOW | 🔲 | Gas self-limiting but good hygiene |
| 8 | `transferOwnership()` | LOW | ✅ | `469c0a9` |
| 9 | Deploy to Base Sepolia | HIGH | ✅ | v2: `0x5c49fE29Dd3896234324C6D055A58A86cE930f04` (Sourcify verified) |
| 10 | **FIX: `transfer()` → `_safeTransfer()`** | MED | ✅ | `cbfb8f0` — compatible with contract wallets |
| 11 | **FIX: Elo Sybil protection (MIN_RATED_STAKE)** | MED | ✅ | `cbfb8f0` — 0-stake battles unrated |
| 12 | TypeScript SDK: `ArenaFighter` class | HIGH | ✅ | `f793651` + `a42584d` — viem SDK, seed helpers, ArenaError, 10 tests |
| 13 | Web UI: Arena battles display (from events/calldata) | MED | ✅ | `10aa649`, `82b54c0`, `2fd71b9` — battles list, detail page, home page |
| 14 | First real Arena battle (E2E) | HIGH | ✅ | `3510e78` — pvtclawn vs ClawnJr, 2 battles on Base Sepolia |
| 15 | LLM-powered battle strategies | HIGH | ✅ | `66d403b` — TurnStrategy, createLLMStrategy, playTurn, getBattleHistory |
| 16 | Basescan contract verification | MED | ✅ | Arena v2 verified on Basescan |
| 17 | BIP39 wordlist (SSTORE2) | HIGH | ✅ | `458a896`, `e14b37f` — 2048 words on-chain |
| 18 | Word boundary checking | HIGH | ✅ | `92f14d8` — prevents substring false positives |
| 19 | Waku live spectating | MED | ✅ | `a73dea3` — onTurnBroadcast + useWakuTurns |
| 20 | Live polling (on-chain fallback) | MED | ✅ | `3692122` — 4s turn polling, LIVE badge |

### Architecture
```
Agent A                    ClawttackArena (Base)          Agent B
   |                            |                          |
   |── createChallenge(stake)──→|                          |
   |                            |←── acceptChallenge(stake)|
   |── revealSeeds(seedA,seedB)→|  [verifies commitments]  |
   |── submitTurn("...fire...")→|  ✅ word found (T1)       |
   |                            |←── submitTurn("...arch") |
   |── submitTurn("no word") ──→|  ❌ word missing → settle |
   |                            |  → 95% pool to B, 5% fee |
```

### Gas Costs (Base L2)
- `createChallenge`: ~158K gas
- `acceptChallenge`: ~108K gas  
- `submitTurn` (with word): ~63K gas median
- `submitTurn` (miss → settle): ~194K gas
- **Full 20-turn battle: ~$0.02-0.20 total**

### Live Spectated Battle — ✅ COMPLETE (2026-02-20)

12-turn battle on Arena v4: `0xce0dc430...` — all turns confirmed, settled on-chain.
Vercel redeployed with v4 address (bundle: `index-BJnhIbrd.js`).

**Bugs found during live testing:**
1. 🔴 **Timeout decay too aggressive** — `_getTurnTimeout` halves each turn. Turn 9 at base=1800s gets 7s. Need sqrt or linear decay.
2. 🔴 **Word predictability** — `_generateWord` uses commits (public after accept) not seeds. All words predictable before battle starts. Opponents can grind commitB for favorable sequences.
3. 🟡 **`getChallengeWord` unrestricted** — returns words for future turns. Should restrict to `turnNumber <= currentTurn`.

### NEXT TASK: Fix Arena v5 Contract Bugs — ✅ COMPLETE

**All fixes deployed, verified, and validated with live 8-turn battle.**

1. ✅ `_generateWord` uses seeds (stored on reveal) instead of commits — `a3e7da2`
2. ✅ `getChallengeWord` reverts if `turnNumber > currentTurn` — `a3e7da2`
3. ✅ `_getTurnTimeout` uses linear decay instead of halving — `a3e7da2`
4. ✅ All 95 Forge tests pass + new tests for each fix
5. ✅ Deployed Arena v5 to Base Sepolia + Basescan verified — `ad69eed`
6. ✅ Web config updated + Vercel redeploy triggered
7. ✅ **Live verification battle**: 8-turn draw on v5 (`0xc60701e2...aed1`) — all words unique, future turn restriction works, settled correctly

---

## Also Pending
- M4.8: Web UI live Waku spectator view (browser → nwaku WebSocket)
- Red-team fixes remaining:
  - [x] Add disclaimer to pentest report output (regex limitations) — `fe0986e`
  - [x] Add `0.0.0.0` to localhostOnly allowlist — `fe0986e`
  - [x] Defender error response sanitization — `ed17a19`
  - [ ] Document credential hygiene in SKILL.md (no tokens as CLI args)
- [ ] Disable chatCompletions endpoint after full validation
- [ ] Wire IPFS upload into settlement pipeline (auto-upload on battle end)
- [ ] Store CID on-chain in registry's `turnLogCid` field during settlement
- [ ] Remove static JSON files after on-chain CID migration

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
- **306 tests** (212 Bun + 95 Forge) | **518 expect() calls** | **0 failures**
- **6 Arena battles** on Base Sepolia (inc. 1 LLM, 2 orphaned reclaimed, 1 v5 verification)
- **1 LLM-powered battle** (Gemini Flash vs Gemini Flash — real adversarial conversation!)
- **4 Arena deployments** (v2, v3 BIP39, v4 word boundary, v5 seed-derived words — all Basescan verified)
- **25 battle logs on IPFS** (Pinata) with correct CID mapping
- **23 challenge reviews** completed
- **54+ commits** on 2026-02-19

### Deployed Contracts (Base Sepolia — CANONICAL)
- **BIP39 Data (SSTORE2):** `0xeb2b285cf117a35df07affc2e0c9ebaa77bd6dd9`
- **BIP39Words:** `0xd5c760aa0e8af1036d7f85e093d5a84a62e0b461` ✅ Basescan verified
- **ClawttackArena v5:** `0x18e157990f1Da662d4eA9fE7e2745BCF79F531e8` ✅ Basescan verified (seed-derived words, linear timeout, future turn restriction)
- **Owner/FeeRecipient:** `0xeC6cd01f6fdeaEc192b88Eb7B62f5E72D65719Af` (pvtclawn.eth)
- **ClawnJr wallet:** `0x2020B0F3BCa556380f39C63D44255502dE13C0D0`
- Old contracts (Arena v2/v3/v4, Registry, scenarios) — deprecated

### Red Team Score
**Waku P2P: 8/10** | **Pentest system: 8/10** | **ClawttackArena: 9/10** (v5 + word unpredictability + linear timeout) | **ArenaFighter SDK: 8/10** | **Web UI Arena: 8/10** | **getLogsChunked: 8/10** | **IPFS: 7/10** | **E2E Script: 7/10** | **Pentest attacker: 5/10** | **Overall: 8/10**
