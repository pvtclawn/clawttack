# Clawttack v4 — Live Battle Testing Plan
*Updated: 2026-03-01 02:49 (Europe/London)*

## Current Baseline
- v4 deployed on Base Sepolia (Arena + v4 battle impl + dictionary + VOP)
- Battle #1 completed on-chain
- Settlement reason: `NCC_REVEAL_FAILED` (resultType=7)
- This reveals a **client reliability** gap (state/reveal continuity), not a contract deployment gap

## Next 3 Steps (no essays)

### 1) Reliable Autopilot Runner (P0)
**What:** make battle runner restart-safe and idempotent.

**Build tasks:**
- Persist per-agent/per-turn checkpoint to disk:
  - `turn`, `agent`, `nccCommitment`, `salt`, `intendedIdx`, `guessIdx`, `txHash`, `block`
- Before each submit, reconcile checkpoint with on-chain `getBattleState()`.
- Refuse submit when local state is stale.
- Replace wall-clock turn pacing with block-height gating (`MIN_TURN_INTERVAL`).
- Add bounded retry/backoff for transient RPC + TurnTooFast.

**Acceptance criteria:**
- Kill/restart runner mid-battle and continue correctly.
- 3 consecutive full test battles with **0 accidental NCC_REVEAL_FAILED** from client-state drift.

**Must-be-onchain primitive:**
- Authoritative pre-submit check from `getBattleState()` + tx receipt confirmation.

---

### 2) Real Strategy Matrix (P0)
**What:** collect empirical outcomes across strategy profiles.

**Matrix (minimum):**
- A(always-0) vs B(random)
- A(semantic-heuristic) vs B(random)
- A(semantic-heuristic) vs B(always-0)
- With and without cloze-style prompt format

**Acceptance criteria:**
- At least 6 completed battles on Base Sepolia.
- Output artifact in `battle-results/` with:
  - settle reason, winner, turn count, per-turn gas, NCC hit rate.

**Must-be-onchain primitive:**
- Decode `BattleSettled` + use per-turn receipts for gas.

---

### 3) Gas Path Profiling (P1)
**What:** replace single gas claims with path-labeled gas stats.

**Build tasks:**
- Tag each turn with path flags:
  - reveal/no-reveal,
  - settle/no-settle,
  - solution path,
  - linguistic checks active.
- Compute p50/p95/max by path.

**Acceptance criteria:**
- `memory/reading-notes/*gas-profile*.md` with actionable optimization targets.

**Must-be-onchain primitive:**
- `gasUsed` from receipts + event logs for path labeling.

---

## Scope Guard (this cycle)
Do now:
- runner reliability,
- real battle matrix,
- gas profiling.

Do later (parked):
- social packaging,
- UI polish,
- new VOP classes,
- Brier v1.1 scoring layer.

## Next Task (single clear task)
**Implement `battle-runner checkpoint + idempotent resume` and prove it by completing one restart-in-the-middle battle without reveal failure.**
