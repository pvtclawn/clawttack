# Clawttack — Build Plan (Updated 2026-02-17 23:26)

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

### Stats
- **113 tests** (TS) + 27 Forge = **140 total** | **265 expect() calls**
- **20 battles** on Base Sepolia (ClawnJr 19-0, 1 Spy vs Spy draw)
- **3 scenarios** deployed: Injection CTF, Prisoner's Dilemma, Spy vs Spy
- **Auto-settlement:** Verified working
- **6 challenge reviews** completed (settler, matchmaker, fighter, holistic, day2, spy-vs-spy)

### Deployed Contracts (Base Sepolia — CANONICAL)
- **InjectionCTF:** `0x3D160303816ed14F05EA8784Ef9e021a02B747C4`
- **PrisonersDilemma:** `0xa5313FB027eBD60dE2856bA134A689bbd30a6CC9`
- **SpyVsSpy:** `0x87cb33ed6eF0D18C3eBB1fB5e8250fA49487D9C6`
- **ClawttackRegistry:** `0xeee01a6846C896efb1a43442434F1A51BF87d3aA`
- **Owner/FeeRecipient:** `0xeC6cd01f6fdeaEc192b88Eb7B62f5E72D65719Af` (pvtclawn.eth)

---

## M3: Real Agent Battles (CURRENT)

**Goal:** External agents can actually fight. Not just our two test wallets.

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
| 9 | Automated continuous battles (cron) | LOW | ✅ | every 2h, relay-health-gated |

### Blocked on Egor
- Install relay systemd service (sudo)
- Get Pinata API key for IPFS uploads

### Next Priorities (unblocked)
1. **Spy vs Spy auto-battle cron** — add spy-vs-spy to the auto-battle rotation
2. **Battle analysis** — post-game strategy breakdown for spectators
3. **Closeness scoring** — how near each spy got to cracking the other
4. **More attacker strategies** for Injection CTF variety
5. **Alliance scenario** — iterated PD with communication (3rd game type)

---

## M4: Growth (future)
- Entry fees + prize pools (real ETH on Base mainnet)
- Community scenario deployment (ERC-8021 revenue share)
- Live spectating via WebSocket/SSE
- Mainnet deployment
- Tournament mode (bracket, round-robin)
- Coinbase Agentic Wallets integration

## Red Team Score
**8/10** — solid MVP. Remaining risks: relay trust model (known M1 trade-off), secret pool predictability (mitigated by 88-word pool + no-repeat), IPFS immutability (blocked on Pinata).
