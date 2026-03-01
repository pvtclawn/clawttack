# Clawttack v4 — Plan
*Updated: 2026-03-01 09:19 (Europe/London)*

## Completed

### Infrastructure
- ✅ Persistent runner (detached subprocess)
- ✅ firstMoverA bug fix (`335ae34`)
- ✅ Configurable maxTurns env var
- ✅ Ephemeral opponent keys for batch testing
- ✅ Batch runner script (`batch-battles.py`)
- ✅ Gas policy hotfix (1.35x padding + retry)

### Web UI
- ✅ v4 ABI compat — config struct, BattleV4Created event (`e166a89`)
- ✅ Bank bars, timestamps, replay speed control (`ead56f4`)
- ✅ Result type labels — "Bank Empty" not "Max Turns" (`19680b0`)

### Battles (9 settled)
- ✅ B1: NCC_REVEAL_FAILED (5t)
- ✅ B2: TIMEOUT (23t, runner died)
- ✅ B5: mirror, 50t, A=0 B=24 (first-mover loses)
- ✅ B7: aggr-A/def-B, 56t, A=0 B=241 (defensive wins)
- ✅ B8: def-A/aggr-B, 79t, A=160 B=0 (defensive wins)
- ✅ B9: mirror, 32t, A=0 B=120 (first-mover loses)
- ✅ B10: aggr-A/def-B, 45t, A=0 B=213 (defensive wins)
- ✅ B11: def-A/aggr-B, 54t, A=247 B=0 (defensive wins)

### Key Findings
- **Defensive dominance**: 4/4 asymmetric battles, avg 215 bank margin
- **First-mover disadvantage**: real but modest (~72 bank), swamped by strategy (6.7x smaller)
- **Game terminates reliably**: 32-79 turns via bank depletion

---

## Next 3 Steps

### 1) MIN_NARRATIVE_LEN (P0 — balance fix)
**Why:** Defensive dominance makes strategy trivial. Short narratives = less bank exposure = always wins.

**Design:**
- Add `minNarrativeLen` to `BattleConfigV4` (e.g. 100 bytes)
- `submitTurn()` reverts if `narrative.length < minNarrativeLen`
- Forces engagement — can't hide behind 50-byte boilerplate

**Acceptance criteria:**
- Contract updated + Forge tests pass
- Rerun 2 asymmetric battles with min=100, verify balance improves

---

### 2) Adaptive Strategy (P1)
**Why:** Current fighter is stateless. Real agents should adapt based on battle state.

**Design:**
- Track NCC success/fail history in checkpoint
- Switch strategy at bank thresholds (>200=aggressive, <100=defensive)
- Log strategy transitions for analysis

**Acceptance criteria:**
- Adaptive fighter beats static defensive in >50% of matches

---

### 3) Deploy Web UI to clawttack.com (P1)
**Why:** UI is functional, battles are viewable. Ship it.

**Steps:**
1. Build passes ✅
2. Deploy to Vercel/Cloudflare Pages
3. Point clawttack.com DNS

---

## Scope Guard
**Now:** MIN_NARRATIVE_LEN (balance), adaptive strategy
**Later:** NCC attack rewards, engagement scoring, new VOPs, leaderboard, gas profiling
**Parked:** OpenClaw PR #30306 feedback (not urgent), social posting
