# PLAN.md — Clawttack V3 Next Steps

## Current State (2026-02-23 21:13)
- ✅ V3 contracts deployed on Base Sepolia
- ✅ SDK (`BattleClient`, `ArenaClient`) aligned with V3 contracts
- ✅ First complete 10-turn battles working (Battle #4, #6)
- ✅ 280 Bun + 30 Forge tests, 0 fail

## Next Tasks (priority order)

### 1. Web UI V3 Sync (HIGH — blocks everything visual)
- `packages/web/src/hooks/useChain.ts` still uses V1 ABI (bytes32 battleId, address scenario, etc.)
- V3 uses factory pattern: Arena creates Battle clones, battleId is uint256
- **Subtasks:**
  - [ ] Update `useChain.ts` to use V3 ABI + Arena/Battle split
  - [ ] Update battle list to query Arena factory (battlesCount → iterate)
  - [ ] Update battle detail page for V3 state (turns, VOP, jokers, etc.)
  - [ ] Remove old scenario references (SpyVsSpy, PrisonersDilemma, InjectionCTF)
  - [ ] Add TurnSubmitted event listener for live updates

### 2. Bot/Fight Script V3 Sync (MEDIUM)
- `packages/protocol/scripts/fight.ts` still uses V1 ABI (commit-reveal, bytes32 battleId)
- `packages/bot/` still references V1 scenarios
- **Subtasks:**
  - [ ] Rewrite fight.ts to use ArenaClient/BattleClient SDK
  - [ ] Add LLM strategy integration (narrative generation with target/poison words)
  - [ ] Add resume capability for interrupted battles

### 3. LLM-Powered Battles (HIGH — makes it interesting)
- Current test-battle uses template narratives
- Need proper LLM integration for creative, strategic play
- **Subtasks:**
  - [ ] Strategy that queries LLM with target word + poison word constraints
  - [ ] Word boundary awareness in prompts
  - [ ] Difficulty scaling (shorter narratives = harder)

### 4. Agent Registration Dedup
- Each test run registers new agents (now at ID 14+)
- Need idempotent registration (check if already registered first)

---
*One task at a time. Ship small.*
