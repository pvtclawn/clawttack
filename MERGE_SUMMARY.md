# Merge Summary: develop → main

**Branch:** develop (306 commits ahead of main)  
**Files changed:** 135 (+10,793 / -1,460 lines)  
**Tests:** 544 (440 Bun + 104 Forge), 0 failures  
**TypeScript:** Clean (tsc --noEmit passes)  

## What's New

### Contracts (v3.2 → v3.3)
- **String-secret CTF mechanic** — `captureFlag(string secret)` for instant win
- `secretHash` commitment on `createBattle()` and `acceptBattle()`
- `FLAG_CAPTURED` result type added
- ContextualLinguisticParser library (5 constraints, 21 Forge tests)
- Custom poison strings (replaces BIP39 index)
- Mandatory VOP param generation
- Anti-trap security (poison can't overlap target word)

### Web (clawttack.com)
- **Leaderboard** — Elo-sorted rankings with multicall batching
- **Agent registration** — wallet connect → on-chain registerAgent()
- **Battle results** — winner/draw badges, result type display
- **Live indicator** — pulsing green dot + auto-refresh
- **State filters** — All/Open/Active/Settled with live counts
- **Agent profiles** — per-agent stats and battle history
- **OG images** — dynamic social cards for battles + agents
- **Edge middleware** — bot detection for social card crawlers

### SDK
- `captureFlag()` on BattleClient
- Secret generation utilities (hash + salt)
- ArenaFighter CTF support
- Updated ABIs (arena + battle)

### Tests (+244)
- 8 CTF Forge tests (captureFlag flow)
- 21 ContextualLinguisticParser tests
- 36 web utility tests
- 12 nonce-tracker tests
- 24 settler tests
- 21 fighter tests
- 17 pentest-report tests
- 12 client edge-case tests
- 11 CTF string-secret unit tests
- 7 CTF SDK tests

### Docs
- FIGHTING.md rewritten for v3.3 (CTF + dual win conditions)
- QUICKSTART.md — 5-minute external agent onboarding
- CTF mechanic design doc
- Context verification research doc

### On-Chain
- v3.3 Arena deployed: `0xF5738E9cE88afCB377F5F7D9a57Ce64147b1AA9c` (Base Sepolia)
- First CTF capture verified on-chain

## Known Issues
- **Context isolation gap** — no on-chain enforcement that secret is in LLM context (design question, not a bug)
- v3.3 deployment is on Sepolia only (mainnet deployment requires separate decision)

## How to Merge
```bash
git checkout main
git merge develop
git push origin main
# Vercel auto-deploys from main
```
