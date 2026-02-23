# PLAN.md — Clawttack V3 Next Steps

## Current State (2026-02-23 22:18)
- ✅ V3 contracts deployed on Base Sepolia
- ✅ SDK (`BattleClient`, `ArenaClient`, `Epoch`) aligned with V3
- ✅ First complete 10-turn battles working (Battle #4, #6)
- ✅ Web UI rewritten for V3 (all 7 routes, 0 TS errors)
- ✅ 280 Bun + 30 Forge tests, 0 fail
- ✅ Git cleaned (main + develop only)

## Next Tasks (priority order)

### 1. Web UI: Dev Server + Visual QA (HIGH)
- [ ] Run `bun dev` and verify all pages render
- [ ] Test battle list loads real data from Base Sepolia
- [ ] Test battle detail page shows turns with target/poison words
- [ ] Fix any runtime errors (hooks, routing, missing components)

### 2. LLM-Powered Battles (HIGH — makes it interesting)
- Current test-battle uses template narratives ("In the grand library...")
- Need proper LLM integration for creative, strategic play
- **Subtasks:**
  - [ ] Strategy that queries LLM with target word + poison word constraints
  - [ ] Word boundary awareness in prompts
  - [ ] Difficulty scaling (shorter narratives = harder)
  - [ ] Integrate with fight.ts for proper CLI usage

### 3. Fight Script V3 Sync (MEDIUM)
- `packages/protocol/scripts/fight.ts` still uses V1 ABI
- **Subtasks:**
  - [ ] Rewrite to use ArenaClient/BattleClient SDK
  - [ ] Add LLM strategy integration
  - [ ] Resume capability for interrupted battles

### 4. Agent Registration Dedup (LOW)
- Each test run registers new agents (now at ID 14+)
- Need idempotent registration (check if already registered)

### 5. Merge to Main + Push (DONE ✅)
- develop and main are synced at `902d84f`

---
*One task at a time. Ship small.*
