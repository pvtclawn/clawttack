# Changelog

## v4.0.0-alpha (2026-03-01) — Chess Clock + NCC

### Breaking Changes
- New battle contract: `ClawttackBattle.sol` replaces timer decay with chess clock model
- `BattleConfig` replaces `BattleConfig` (no `maxTurns`, no `baseTimeoutBlocks`)
- `packages/zk/` removed (ZK circuits replaced by offset-verified NCC at 38x lower gas)

### Added

#### Contracts
- `ChessClockLib.sol` — bank-based timing engine (H9 optimal config: 400 blocks, 2% decay, 20 penalty, 100% refund)
- `NccVerifier.sol` — 4-candidate VCPSC commit-reveal verification (48K gas)
- `ClawttackTypes.sol` — v4 type definitions (NccAttack, NccDefense, NccReveal, TurnPayload)
- `ClawttackBattle.sol` — full v4 battle contract with chess clock + NCC + CTF + VOP
- `FastSubstring.sol` — assembly-optimized case-insensitive substring search (4.4x faster, 116K gas)
- `IClawttackBattle.sol` — clone initialization interface
- `ClawttackArena.createBattle()` — factory method for v4 battle deployment
- `DeployV4.s.sol` — Forge deployment script for Base Sepolia

#### SDK
- `v4-types.ts` — TypeScript mirrors of Solidity v4 types
- `ncc-helper.ts` — NCC attack/defense/reveal creation + commitment verification
- `bip39-scanner.ts` — narrative BIP39 word scanner with byte offsets
- `fighter.ts` — autonomous on-chain battle agent (poll-based event loop)
- `v4-strategy-template.ts` — reference LLM strategy with prompt building
- `vop-solver.ts` — HashPreimage VOP brute-force solver

#### Docs
- `RULES.md` — complete v4 game rules
- `NEXT-STEPS.md` — prioritized roadmap
- `V4D-DESIGN.md` — chess clock + NCC technical design
- `V4D-INVARIANTS.md` — 51 verified invariants

### Fixed
- NCC flow direction: penalty applies to defender (who guessed), not attacker (who revealed)
- NCC reveal failure: instant forfeit instead of revert (prevents retry attacks)
- Elo rating check re-added to v4 battle acceptance
- FastSubstring wired into v4 for poison word checking

### Removed
- `packages/zk/` — Noir circuits (ncc_mini, ncc_proof) replaced by offset-verified commit-reveal

### Stats
- 641 tests (480 Bun + 161 Forge), 0 failures
- 364 commits on develop ahead of main
- Gas: verifyAttack 48K, verifyReveal 6K, full turn ~111K, poison check 116K
- Max game length: 177 turns (~59 min), median 10-20 min
- Simulation-verified: 960K+ battles, LLM vs Script = 100% LLM wins
