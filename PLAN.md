# Clawttack — Build Plan (Updated 2026-02-16 16:26)

## Current Status

### M1: Trustless Foundation — IN PROGRESS

| # | Task | Status | Commit/Notes |
|---|------|--------|-------|
| 1 | WebSocket relay server with signed messages | ✅ DONE | `19d4d13`, `d62402f`, `880029a` |
| 2 | ECDSA signing (Solidity-compatible) | ✅ DONE | `19d4d13` — canonicalTurnHash, signTurn, verifyTurn |
| 3 | Battle log export/verify + Merkle root | ✅ DONE | `b040466` — self-settlement enabled |
| 4 | Rate limiter | ✅ DONE | `b040466` |
| 5 | HTTP API (Hono) | ✅ DONE | `d62402f` — CRUD + WS upgrade |
| 6 | E2E integration test (real WS) | ✅ DONE | `880029a` — full battle lifecycle |
| 7 | Architecture doc v2 | ✅ DONE | `bd01fcb` |
| 8 | Waku transport PoC | 🟡 PARTIAL | Connects, subscribes. Send fails (peer availability). Documented. |
| 9 | Transport-agnostic SDK (`ITransport`) | 🔲 TODO | Pending Egor's transport decision |
| 10 | IPFS upload service (Pinata) | 🔲 TODO | Research done, Pinata free tier chosen |
| 11 | ClawttackRegistry.sol v2 | 🔲 TODO | Commit-reveal, IPFS CID, escrow |
| 12 | InjectionCTF.sol scenario | 🔲 TODO | On-chain secret verification |
| 13 | Basic web UI (clawttack.com) | 🔲 TODO | Vercel, reads chain + IPFS |
| 14 | Agent SDK package | 🔲 TODO | `@clawttack/fighter` |

### Tests: 70 passing | LOC: 2,783 src + 1,350 tests | Commits today: 9

## Blocking Decisions

1. **Transport layer**: WS relay (works now) vs Waku (P2P, needs maturation) vs both (transport-agnostic)
   - Egor's preference: platform-agnostic, minimal server load
   - Proposed: ship WS, add Waku later via `ITransport` interface
   - **AWAITING EGOR'S INPUT**

2. **clawttack.com hosting**: Vercel confirmed ✅ (Egor bought domain)

## Next 3 Tasks (after transport decision)

1. **`ITransport` interface + WebSocket implementation** — abstract the transport so Waku slots in later
2. **IPFS upload service** — Pinata integration, wire to `onBattleEnd`
3. **Solidity contracts** — ClawttackRegistry.sol + InjectionCTF.sol on Base Sepolia

## Red-Team Findings (from Lane F)

Top 3 priorities to address in code:
1. **Sybil resistance** — Elo decay, opponent strength weighting, min battle history
2. **Self-settlement** — ✅ Partially done (battle-log.ts). Need contract support.
3. **WSS + rate limiting** — ✅ Rate limiter done. WSS via reverse proxy (nginx/Caddy).

## Reading Notes Applied

From Game Theory Fundamentals:
- Elo should decay for inactive agents (prevents farm-and-sit)
- Repeated games change equilibrium — reputation matters more than one-shot wins
- Prisoner's Dilemma is a great second scenario (pure game theory)
- Entry fees make Sybil expensive (economic barrier)

## Research Findings

- **No competitor** builds a trustless, open protocol for agent battles
- Bot Games (centralized, event-based, no blockchain) — different niche
- Pinata free tier: 1GB = ~20,000 battle logs
- Waku: promising but needs maturation or own relay node
