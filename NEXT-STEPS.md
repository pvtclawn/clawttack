# NEXT STEPS

**Status:** ALL P0s COMPLETE. Ready for testnet deployment.  
**Date:** March 1, 2026  
**Tests:** 637 (480 Bun + 157 Forge), 0 failures

---

## What's Done ✅

### Contracts (Solidity)
- [x] `ChessClockLib.sol` — timing engine (14 tests)
- [x] `NccVerifier.sol` — NCC verification, 48K gas (15 tests)
- [x] `ClawttackTypes.sol` — v4 types
- [x] `ClawttackBattle.sol` — full battle contract (6 integration tests)
- [x] `FastSubstring.sol` — 4.4x faster poison check (14 tests)
- [x] Self-audit: 5 findings, 2 fixed (Elo check + reveal forfeit)

### SDK (TypeScript)
- [x] `types.ts` — TypeScript mirrors of Solidity types
- [x] `ncc-helper.ts` — attack/defense/reveal (15 tests)
- [x] `bip39-scanner.ts` — narrative word scanner (10 tests)
- [x] `fighter.ts` — autonomous on-chain battle agent
- [x] `strategy-template.ts` — reference LLM strategy (5 tests)

### Docs
- [x] `RULES.md` — complete game rules
- [x] `V4D-DESIGN.md` — technical design (chess clock + NCC flow)
- [x] `V4D-INVARIANTS.md` — 51 invariants
- [x] SDK README updated

### Analysis
- [x] ZK deleted (Egor confirmed)
- [x] 5 attack vectors analyzed (0 showstoppers)
- [x] 12 research docs re-read, missed insights captured
- [x] 960K+ battles simulated across 15 timing models

---

## What's Left (Priority Order)

### P0 — Must Have for Deployment

1. **~~Arena factory v4~~** ✅ — `createBattle()` in ClawttackArena.sol (commit 38423f1)

2. **VOP solver** — Fighter has `solution: 0n` placeholder. Need SDK module that solves VOP challenges (hash preimages, TWAP reads).
   - Estimate: 2-4 hours
   - Can stub initially (arena can disable VOPs for testing)

3. **~~Deployment script~~** ✅ — `DeployV4.s.sol` (commit 7882108)

4. **~~VOP solver~~** ✅ — `vop-solver.ts` HashPreimage brute-force (commit 351c430)

### P1 — Should Have Before Mainnet

4. **Defender commit-reveal** — Currently NCC defense is plaintext (visible in mempool). Should be commit-reveal to prevent frontrunning.
   - Identified by Kimi as economic attack
   - Estimate: 3-4 hours (contract + SDK changes)

5. **Event-based fighter** — Current Fighter polls. Switch to event listeners for lower latency.
   - Estimate: 2 hours

6. **Gas optimization** — `containsSubstring` still 116K. Assembly SIMD or different algorithm could push to ~50K.
   - Estimate: 2-3 hours

### P2 — Nice to Have for v1

7. **Brier scoring** — Punishes trivial riddles economically. Deferred to v1.1 but could add now.
   - Egor asked about this — gave him pros/cons
   - Estimate: 4-6 hours

8. **Battle indexer** — Backend service that indexes TurnSubmitted events for battle replays/spectating.
   - Estimate: 4-6 hours

### P3 — v2 Roadmap

9. **Jury/Appeal system** — Decentralized solvability verification
10. **VRF randomness** — Replace blockhash with Chainlink VRF
11. **Cross-chain support** — Deploy on other L2s

---

## Merge Plan

When Egor approves:
1. `git checkout main && git merge develop` (355+ commits ahead)
2. Tag `v0.1.0-alpha`
3. Deploy to Base Sepolia for testing
4. First battle between two test agents
