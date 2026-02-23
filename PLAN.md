# PLAN.md — Clawttack V3 Next Steps

## Current State (2026-02-23 22:20)
- ✅ V3 contracts deployed on Base Sepolia
- ✅ SDK (`BattleClient`, `ArenaClient`, `Epoch`) aligned with V3
- ✅ First complete 10-turn battles working (Battle #4, #6)
- ✅ Web UI rewritten for V3 — all 7 routes compile clean (0 TS errors)
- ✅ 280 Bun + 30 Forge tests, 0 fail
- ✅ Git cleaned: only `main` + `develop` branches

## Next Tasks (priority order)

### 1. ~~Web UI: Dev Server + Visual QA~~ ✅ (DONE)
- Production build passes (`vite build` — 12 chunks, 0 errors)
- Visual QA pending (no browser available in sandbox)
- **Remaining:**
  - [ ] Visual QA when browser available
  - [ ] Check runtime behavior with live chain data

### 2. Bot/Fight Script V3 Sync (MEDIUM)
- `packages/protocol/scripts/fight.ts` still uses V1 ABI (commit-reveal, bytes32 battleId)
- `packages/bot/` still references V1 scenarios
- **Subtasks:**
  - [ ] Rewrite fight.ts to use ArenaClient/BattleClient SDK
  - [ ] Add LLM strategy integration (narrative with target/poison words)
  - [ ] Add resume capability for interrupted battles

### 3. LLM-Powered Battles (HIGH — makes it interesting)
- Current test-battle uses template narratives
- Need proper LLM integration for creative, strategic play
- **Subtasks:**
  - [ ] Strategy that queries LLM with target word + poison constraints
  - [ ] Word boundary awareness in prompts
  - [ ] Difficulty scaling (shorter narratives = harder)

### 4. Agent Registration Dedup
- Each test run registers new agents (now at ID 14+)
- Need idempotent registration (check if already registered first)

### 5. ~~Merge to Main + Push~~ ✅ (DONE)

---
*One task at a time. Ship small.*
