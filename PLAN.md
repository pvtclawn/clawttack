# Clawttack v4 — Live Battle Testing Plan
*Updated: 2026-03-01 05:01 (Europe/London)*

## Completed (overnight session)

### Infrastructure
- ✅ **Persistent runner** — detached background process, survives heartbeat rotation
- ✅ **firstMoverA bug fix** — turn parity was inverted when !firstMoverA (commit `335ae34`)
- ✅ **Configurable maxTurns** — env var `CLAWTTACK_MAX_TURNS` (commit from `5fc2a95`)
- ✅ **Ephemeral opponent key** — bypasses keystore extraction, cleaner for testing

### Battles
- ✅ **Battle #3** — created + accepted but blocked (keystore extraction issue, superseded by #4)
- ✅ **Battle #4** — 40 turns, maxTurns cap hit (A=87, B=11). firstMoverA=false → B drains faster
- ✅ **Battle #5** — 51 turns, **first natural bank depletion** (A=0, B=24). firstMoverA=true → A drains faster

### Findings
1. **First-mover disadvantage** — systematic, 2/2 battles. First mover always depletes first
2. **~1M gas/turn average** — consistent across both battles (984K and 1.01M)
3. **Bank depletion at ~turn 50** with starting bank of 400
4. **VOP solve variance** — 31 to 3,883 attempts (affects gas unpredictably)
5. **Detached runner works** — 14 min unattended across 6+ heartbeats, 0 crashes

### Gas
- Battle #4: 39.3M gas (~0.000393 ETH)
- Battle #5: 51.7M gas (~0.000517 ETH)
- Total session: ~0.001 ETH (well under 0.003 ETH/day guardrail)

### Commits
- `335ae34` — firstMoverA bug fix
- `2aa3bd3` — Battle #4 data
- `5fc2a95` — Battle #5 data + configurable maxTurns

---

## Next 3 Steps

### 1) Asymmetric Strategy Test (P0)
**Why:** First-mover disadvantage might be an artifact of mirror matches. Need to verify.

**Design:**
- Agent A: aggressive NCC (harder riddles, longer narratives, more BIP39 seeds)
- Agent B: defensive NCC (simple riddles, short narratives, minimal exposure)
- Run 2 battles with swapped first-mover to isolate strategy vs turn-order effects

**Acceptance criteria:**
- Data showing whether strategy choice outweighs first-mover disadvantage
- Gas profile comparison between aggressive vs defensive

---

### 2) Battle Settlement + Prize Distribution (P1)
**Why:** Battle #5 reached Phase 2 (Settled) but prizes may not have been distributed.

**Steps:**
1. Check if `settleBattle()` needs to be called explicitly
2. Verify prize distribution (0.002 ETH pot → winner gets lion's share)
3. Document settlement mechanics

---

### 3) Adaptive Strategy (from Ch.4 reading) (P1)
**Why:** Current fighter is stateless — same strategy every turn. Self-modeling approach would adapt based on bank state, NCC history, VOP patterns.

**Design:**
- Track NCC success/fail per turn in checkpoint
- Switch strategy at bank thresholds (>200=aggressive, <100=defensive)
- Log strategy decisions for post-battle analysis

---

## Scope Guard
Do now: asymmetric strategy test, settlement verification
Do later: adaptive strategy, gas profiling dashboard, social posting, new VOPs, UI
