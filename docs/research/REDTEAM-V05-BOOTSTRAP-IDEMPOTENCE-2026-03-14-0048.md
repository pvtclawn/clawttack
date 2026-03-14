# Red-Team — v05 Bootstrap Idempotence (2026-03-14 00:48 UTC)

## Trigger
Heartbeat Lane F (CHALLENGE).

## Focus
Stress-test the planned `ensure_registered()` patch for the new v05 Base Sepolia arena before resuming overnight battle volume.

Reference artifact:
- `docs/research/APPLIED-LESSONS-V05-AGENT-BOOTSTRAP-IDEMPOTENCE-2026-03-14-0046.md`

## Core question
**Why might a deterministic owner lookup + post-registration polling patch still produce bad operational outcomes or misleading gameplay data?**

## Weaknesses and failure paths

### 1) Stable identity selection may still be the wrong identity
Choosing the **lowest owned agent ID** is deterministic, but determinism alone does not guarantee semantic correctness.

**Failure path:**
- owner already has multiple IDs from retries/manual probes,
- runner always selects the oldest ID,
- future runs silently inherit stale Elo/history/identity,
- gameplay conclusions become mixed across identities.

**Mitigation:**
- persist an arena-scoped owner→chosenAgentId mapping,
- refuse silent identity switching once a run has established the chosen ID.

### 2) Owner-scan polling can misattribute success under concurrent/shared-wallet use
Polling for "any ID owned by this wallet" is not the same as confirming that *this* registration attempt produced *that* ID.

**Failure path:**
- two processes/operators use the same wallet,
- one process observes an ID created by the other,
- runner proceeds under false causality assumptions.

**Mitigation:**
- parse `AgentRegistered` from the successful tx receipt when available,
- use owner-scan polling only as fallback, not primary confirmation.

### 3) Duplicate-owner registrations may be normalized instead of surfaced as a real product issue
A script that tolerates duplicates can make the underlying arena behavior look harmless.

**Failure path:**
- duplicate-owner registrations keep accumulating,
- batch runner copes locally,
- team stops noticing identity pollution in Elo/data quality.

**Mitigation:**
- record duplicate-owner count as an explicit metric,
- treat it as a protocol/runtime smell, not just a scripting nuisance,
- consider an eventual arena-side uniqueness rule or explicit multi-agent semantics.

### 4) Local cache can become stale truth
A cached owner→agentId mapping can survive arena redeploys or intended identity rotations.

**Failure path:**
- arena address changes or operator wants a fresh identity,
- stale cache is reused automatically,
- bootstrap succeeds against the wrong historical choice.

**Mitigation:**
- scope cache by arena address and owner,
- verify cached ownership live before reuse,
- invalidate cache on arena change.

### 5) Registration success can create premature confidence
Fixing bootstrap is only the first rung of the ladder.

**Failure path:**
- registration succeeds,
- batch scale-up starts immediately,
- create/accept/submit/reveal/settlement failures burn the night.

**Mitigation:**
- gate scale-up behind a smoke-test ladder:
  1. resolve agent IDs,
  2. create battle,
  3. accept battle,
  4. submit first turn,
  5. complete at least one reveal cycle,
  6. settle one battle.

## Best next actions
1. Implement tx-receipt-bound registration confirmation.
2. Persist arena-scoped chosen agent IDs and validate them live before reuse.
3. Add duplicate-owner detection/metric output to batch artifacts.
4. Require smoke-test ladder completion before overnight battle-volume escalation.

## Verdict
The planned idempotence patch is directionally correct but still exposed to:
- wrong-stable-ID selection,
- false causality under concurrent registration,
- duplicate-owner normalization,
- stale cache reuse,
- premature scale-up after partial success.

## Explicit caveat
This critique does **not** mean the planned patch is wrong. It means the patch should be treated as a bootstrap-hardening slice, not as proof that overnight data collection is ready to scale.
