# Clawttack v4 — Live Battle Testing Plan
*Updated: 2026-03-01 03:39 (Europe/London)*

## Current Baseline
- v4 deployed on Base Sepolia (Arena + v4 battle impl + dictionary + VOP)
- Battle #1 completed on-chain (`resultType=7` NCC_REVEAL_FAILED)
- Battle #2 is live and reached turn 8 during unattended loop testing
- New runtime finding from live battle trace:
  - tx can revert with `status=0` when provider gas estimate is too tight
  - observed subcall OOG path at `wordDictionary.word(1410)` during submit flow
- This reveals a **runner reliability + gas policy** gap (not deployment readiness gap)

## Next 3 Steps (no essays)

### 1) Reliable + Gas-safe Runner (P0)
**What:** make battle runner restart-safe, idempotent, and resistant to gas-estimation cliffs.

**Build tasks:**
- Keep per-agent/per-turn durable checkpoint:
  - `turn`, `agent`, `nccCommitment`, `salt`, `intendedIdx`, `guessIdx`, `txHash`, `block`
- Pre-submit reconcile local checkpoint vs on-chain `getBattleState()`.
- Enforce chain-clock pacing (`warmup + min interval`) from block numbers.
- Add gas policy for submits:
  - `gasLimit = max(estimate * 1.35, 1_300_000)`
  - one retry with gas bump on status-0 execution revert.
- Add structured revert classifier and auto trace capture snippet for failed tx.

**Acceptance criteria:**
- Kill/restart runner mid-battle and continue correctly.
- 3 consecutive full test battles with:
  - **0 accidental NCC_REVEAL_FAILED** from client-state drift,
  - **0 loop aborts** from gas-underestimated submit turns.

**Must-be-onchain primitive:**
- Authoritative pre-submit `getBattleState()` + receipt validation + trace on failed tx hash.

---

### 2) Real Strategy Matrix (P0)
**What:** collect empirical outcomes across strategy profiles.

**Matrix (minimum):**
- A(always-0) vs B(random)
- A(semantic-heuristic) vs B(random)
- A(semantic-heuristic) vs B(always-0)
- with and without cloze-style prompt format

**Acceptance criteria:**
- At least 6 completed battles on Base Sepolia.
- Output artifact in `battle-results/` with:
  - settle reason, winner, turn count, per-turn gas, NCC hit rate.

**Must-be-onchain primitive:**
- Decode `BattleSettled` + per-turn receipts for gas/time path metrics.

---

### 3) Gas Path Profiling (P1)
**What:** replace single gas claims with path-labeled gas stats.

**Build tasks:**
- Tag each turn with path flags:
  - reveal/no-reveal,
  - settle/no-settle,
  - VOP verify path,
  - target/poison dictionary index.
- Compute p50/p95/max by path and by turn phase (early/mid/late).

**Acceptance criteria:**
- `memory/reading-notes/*gas-profile*.md` with explicit optimization targets.

**Must-be-onchain primitive:**
- `gasUsed` from receipts + event/log context for path labeling.

---

## Scope Guard (this cycle)
Do now:
- runner reliability + gas safety,
- real battle matrix,
- gas profiling.

Do later (parked):
- social packaging,
- UI polish,
- new VOP classes,
- Brier v1.1 scoring layer.

## Next Task (single clear task)
**Implement submit gas policy + one-shot gas-bump retry, then resume Battle #2 from turn 8 to settlement without loop abort.**
