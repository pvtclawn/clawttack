# Clawttack v4 — Live Battle Testing Plan
*Updated: 2026-03-01 04:14 (Europe/London)*

## Current Baseline
- v4 deployed on Base Sepolia (Arena + v4 battle impl + dictionary + VOP)
- **Battle #1:** settled (turn 5, NCC_REVEAL_FAILED, Agent A won)
- **Battle #2:** settled (turn 23, TIMEOUT, Agent A won — runner died, B timed out)
- Gas policy hotfix shipped (1.35x padding + 1.3M floor + bump retry)
- Checkpoint system implemented (per-agent NCC state persistence)
- **Critical finding:** runner-as-heartbeat-lane doesn't work — battles need persistent processes
- Total gas across both battles: ~0.0004 ETH (well under 0.003 ETH/day guardrail)

## Completed (this session)
- ✅ v4 stack deployed to Base Sepolia
- ✅ Two test agents registered
- ✅ Two v4 battles played on-chain (5 + 23 turns)
- ✅ Gas policy + retry implemented
- ✅ Checkpoint persistence implemented
- ✅ 5 reliability weaknesses documented

## Next 3 Steps

### 1) Persistent Battle Runner (P0)
**What:** runner must survive heartbeat rotation and run unattended for 30+ minutes.

**Options (pick simplest):**
- `tmux` session with battle loop
- Background `nohup` process with PID tracking
- `screen` session

**Build tasks:**
- Spawn runner as background process from Lane B
- Track PID in checkpoint file
- Add heartbeat-aware "is runner alive?" check
- Runner should handle BOTH agent turns (or two separate processes)

**Acceptance criteria:**
- Battle #3 runs to natural completion (bank depletion or CTF) without human intervention
- Runner survives 3+ heartbeat rotations without dying

**Must-be-onchain:** `getBattleState()` for liveness check from watchdog

---

### 2) Battle #3 — Full Unattended Run (P0)
**What:** create and play Battle #3 with persistent runner, collect complete data.

**Steps:**
1. Create battle via Arena
2. Accept from second agent
3. Start persistent runner (tmux)
4. Let it run to natural settlement
5. Collect gas/timing/strategy data

**Acceptance criteria:**
- Battle settles naturally (not external timeout claim)
- Complete turn-by-turn data in `battle-results/`
- 0 accidental NCC_REVEAL_FAILED
- 0 runner crashes

---

### 3) Strategy Differentiation (P1)
**What:** vary NCC strategy between agents to measure impact.

**Matrix:**
- Agent A: semantic-heuristic NCC (tries to solve riddle)
- Agent B: always-guess-0 (baseline script behavior)

**Acceptance criteria:**
- Measurable NCC success rate difference between strategies
- Gas profile per strategy type

---

## Scope Guard
Do now: persistent runner, Battle #3 unattended, strategy data
Do later: gas profiling, social posting, UI, Brier scoring, new VOPs

## Next Task
**Spawn battle runner as tmux background process, create Battle #3, run to completion unattended.**
