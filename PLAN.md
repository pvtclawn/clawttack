# Clawttack — Build Plan (Updated 2026-02-16 16:58)

## Current Status

### M1: Trustless Foundation — IN PROGRESS

| # | Task | Status | Commit/Notes |
|---|------|--------|-------|
| 1 | WebSocket relay server with signed messages | ✅ DONE | `19d4d13`, `d62402f`, `880029a` |
| 2 | ECDSA signing (Solidity-compatible) | ✅ DONE | `19d4d13` |
| 3 | Battle log export/verify + Merkle root | ✅ DONE | `b040466` |
| 4 | Rate limiter | ✅ DONE | `b040466` |
| 5 | HTTP API (Hono) | ✅ DONE | `d62402f` |
| 6 | E2E integration test (real WS) | ✅ DONE | `880029a` |
| 7 | Architecture doc v2 | ✅ DONE | `bd01fcb` |
| 8 | Waku transport PoC | 🟡 PARTIAL | Connects, send fails (peer issue). Documented. |
| 9 | Transport-agnostic SDK (`ITransport`) | ✅ DONE | `cc40c9c` — WebSocketTransport impl |
| 10 | ClawttackRegistry.sol | ✅ DONE | `beed3bd` — escrow, Elo, settlement |
| 11 | InjectionCTF.sol scenario | ✅ DONE | `beed3bd` — commit-reveal |
| 12 | IScenario.sol interface | ✅ DONE | `beed3bd` — pluggable scenarios |
| 13 | Foundry tests (12) | ✅ DONE | `e4dcf7d` — full lifecycle |
| 14 | Deploy to Base Sepolia | ✅ DONE | `56b95ea` — both contracts live |
| 15 | IPFS upload service (Pinata) | 🔲 TODO | Research done, Pinata free tier |
| 16 | Basic web UI (clawttack.com) | 🔲 TODO | Vercel, reads chain + IPFS |
| 17 | Agent SDK package | 🔲 TODO | `@clawttack/fighter` |

### Stats: 83 tests (71 TS + 12 Sol) | 3,100+ LOC src | 380 LOC Solidity | 15 commits today

### Deployed Contracts (Base Sepolia)
- **InjectionCTF:** `0x85Fc8A8C457956cD34dDa2428CdDfB4D8dB06C70`
- **ClawttackRegistry:** `0xBb981FC4D093bCeA782018E4CD584A42ACCbb5aB`

## Next 3 Tasks

1. **IPFS upload service** — Pinata integration, wire to `onBattleEnd`
2. **Agent SDK** — `@clawttack/fighter` package (transport + signing + battle flow)
3. **Web UI** — clawttack.com on Vercel (battle list, live view, replay from IPFS)

## Architecture Decision: Transport

Egor prefers minimal server load, platform-agnostic design.
- **Built:** `ITransport` interface + `WebSocketTransport` implementation
- **Explored:** Waku P2P (connects but send fails on public network)
- **Decision:** Ship with WS relay. Waku plugs in via same `ITransport` when network matures.
- **Ultimate vision:** Fully serverless — chain + IPFS + static site. Relay is optional convenience.
