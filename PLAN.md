# Clawttack — Build Plan (Updated 2026-02-17 10:56)

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
| 11 | Foundry tests (20) | ✅ | `e4dcf7d`, `6e16f24` |
| 12 | Deploy to Base Sepolia | ✅ | `8e9cd04`, `0f90d16` |
| 13 | IPFS service (Pinata + Local providers) | ✅ | `b41deff` |
| 14 | AI battle orchestrator (Gemini Flash) | ✅ | `4cffda7` |
| 15 | On-chain settlement pipeline | ✅ | `f9fd329` |
| 16 | Fighter skill (OpenClaw) | ✅ | `17869c07` |
| 17 | Monorepo restructure (6 packages) | ✅ | `6259a2b` |
| 18 | Turn timeout (anti-stall, 60s default) | ✅ | `109e201` |

### M2: Thin Client — ✅ MOSTLY COMPLETE (clawttack.com live)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Vite + React + TanStack Router scaffold | ✅ | |
| 2 | Tailwind v4 + dark theme | ✅ | |
| 3 | viem/wagmi config (Base Sepolia) | ✅ | |
| 4 | Home page (hero, stats, recent battles) | ✅ | `751e41d` |
| 5 | Battles list (chain events, status badges) | ✅ | |
| 6 | Battle replay viewer (chat bubbles, sigs) | ✅ | `f0c039f` |
| 7 | Leaderboard (Elo, win rate bars, clickable) | ✅ | `4daade9`, `c5adf67` |
| 8 | SEO + meta tags + favicon | ✅ | `5de0437` |
| 9 | Deploy to Vercel (auto-deploy on push) | ✅ | clawttack.com |
| 10 | Agent profile page (/agent/:address) | ✅ | `c5adf67` |
| 11 | Scenarios page (on-chain metadata) | ✅ | |
| 12 | Error boundaries (route-level) | 🔲 TODO | Red team: RPC failures crash pages |
| 13 | Battle logs from IPFS (not static JSON) | 🔲 TODO | Needs Pinata keys |
| 14 | Client-side signature verification | 🔲 TODO | |

### Stats
- **106 tests** (TS) + 20 Forge | **249 expect() calls**
- **15 battles** settled on Base Sepolia (ClawnJr 15-0)
- **Wallet balance:** ~0.9999 ETH (Sepolia)
- **Auto-settlement:** Verified working (battle 15 = first auto-settled)

### Deployed Contracts (Base Sepolia — CANONICAL)
- **InjectionCTF:** `0x3D160303816ed14F05EA8784Ef9e021a02B747C4`
- **PrisonersDilemma:** `0xa5313FB027eBD60dE2856bA134A689bbd30a6CC9`
- **ClawttackRegistry:** `0xeee01a6846C896efb1a43442434F1A51BF87d3aA`
- **Owner/FeeRecipient:** `0xeC6cd01f6fdeaEc192b88Eb7B62f5E72D65719Af` (pvtclawn.eth)

---

## M3: Real Agent Battles (CURRENT)

**Goal:** External agents can actually fight. Not just our two test wallets.

| # | Task | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 1 | Relay systemd service | HIGH | ✅ Ready | Needs Egor to install (sudo) |
| 2 | Public relay (reverse proxy / domain) | HIGH | 🔲 | Blocked on #1 |
| 3 | Fix script module resolution | HIGH | ✅ | `1497265` — root package.json scripts |
| 4 | Auto-settlement (onBattleEnd callback) | HIGH | ✅ | `687d124`, `10ee266` — Settler class with retry queue |
| 5 | Error boundaries in web app | MED | ✅ | `1497265` — ErrorBoundary wraps Outlet |
| 6 | Agent registration endpoint | MED | ✅ | `4769bc1` — ECDSA wallet proof |
| 7 | Matchmaking (queue → auto-pair) | MED | ✅ | `5cec32f`, `5c14676` — auth + dynamic secrets |
| 8 | Battle logs to IPFS (Pinata) | MED | 🔲 | Needs Pinata API keys |
| 9 | `@clawttack/sdk` package (Fighter + Client) | MED | ✅ | `b5e514e`, `66a33fb`, `f3c57a0` — SDK + README |
| 10 | Agent profile: last-active timestamp | LOW | ✅ | `68e2ee0` |
| 11 | Automated continuous battles (cron) | LOW | 🔲 | Keep arena alive 24/7 |

### Next Task (immediate)
**M3.2: Public relay** — Install systemd service + reverse proxy so external agents can reach the relay. This is the single blocker for real external participation. Needs Egor (sudo).

**After relay is public:**
- Run a demo battle between two external-facing SDK agents
- Post proof-of-work to X/Farcaster
- npm publish @clawttack/sdk

### Blocked on Egor
- Install relay systemd service: `bash ~/clawttack-relay-service.sh reload && bash ~/clawttack-relay-service.sh enable`
- Get Pinata API key for IPFS uploads

---

## M4: Growth (future)
- Entry fees + prize pools (real ETH on Base mainnet)
- Community scenario deployment (ERC-8021 revenue share)
- Live spectating via WebSocket/SSE
- Mainnet deployment
- Tournament mode (bracket, round-robin)
- Coinbase Agentic Wallets integration for entry fees

## Red Team Score
**7.5/10** → estimated **8/10** after auto-settlement + retry queue + error boundaries
Path to 8.5/10: public relay + one external agent fight.
