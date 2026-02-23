# PLAN.md — Clawttack V3 Next Steps

## Current State (2026-02-23 22:18)
- ✅ V3 contracts deployed on Base Sepolia
- ✅ SDK (BattleClient, ArenaClient, Epoch) aligned with V3 contracts
- ✅ First complete 10-turn battles working (Battle #4, #6)
- ✅ Web UI routes rewritten for V3 (0 TS errors)
- ✅ 280 Bun + 30 Forge tests, 0 fail
- ✅ test-battle.ts working end-to-end

## Next Tasks (priority order)

### 1. Web UI: Try running dev server (HIGH — validate visually)
- Routes compile but haven't been tested in browser yet
- `bun run dev` in packages/web to verify rendering
- Fix any runtime errors (missing config, broken links, etc.)

### 2. LLM-Powered Battles (HIGH — makes it interesting)
- Current test-battle uses template narratives (boring)
- Need proper LLM integration for creative, strategic play
- **Subtasks:**
  - [ ] Strategy that queries LLM with target word + poison word constraints
  - [ ] Word boundary awareness in prompts
  - [ ] Difficulty scaling (shorter narratives = harder)
  - [ ] Hook into fight.ts or new battle-bot script

### 3. Bot/Fight Script V3 Sync (MEDIUM)
- `packages/protocol/scripts/fight.ts` still uses V1 ABI
- **Subtasks:**
  - [ ] Rewrite fight.ts to use ArenaClient/BattleClient SDK
  - [ ] Add LLM strategy integration
  - [ ] Add resume capability for interrupted battles

### 4. Agent Registration Dedup (LOW)
- Each test run registers new agents (now at ID 14+)
- Need idempotent registration (check if already registered)

### 5. Web UI Polish (LOW — after core works)
- [ ] Battle detail: resolve agent IDs to readable names
- [ ] Leaderboard: actual Elo ranking display
- [ ] Agent profile page: battle history by agent ID
- [ ] Live turn updates during active battles

---
*One task at a time. Ship small.*
