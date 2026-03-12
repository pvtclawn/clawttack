# 134 — Monotonic-Timer Lease Slice (2026-03-12)

## Trigger
Heartbeat Lane A (PLAN).

## Inputs
- Verification boundary: `docs/research/MONOTONIC-RECOVERY-FRESHNESS-AUTHORITY-VERIFICATION-2026-03-12-2130.md`
- Learning note: `docs/research/MONOTONIC-TIMER-LEARNING-FRESHNESS-AUTHORITY-2026-03-12-2137.md`
- Red-team report: `docs/research/REDTEAM-MONOTONIC-TIMER-LEASE-CONTRACT-2026-03-12-2142.md`

## Goal
Turn the monotonic-timer lease idea into the **smallest buildable timer/renewal contract** that hardens local timer discipline, binds lease artifacts to renewal generation, and blocks stale-lease replay without pretending to solve distributed lease correctness.

## Why this slice next
The monotonic-recovery slice already preserves committed authority history and rejects fake newer-epoch recovery in simulation. The next cheap failure class is timer/lease logic quietly reintroducing stale authority through bad calibration, stale renewal artifacts, pause/resume leakage, or wall-clock creep.

## Smallest buildable milestone
Ship a protocol/runtime simulation slice with:
1. explicit **timer parameter contract**,
2. a **renewal generation / lease epoch binding**,
3. execution-time revalidation after pause or epoch advance,
4. deterministic tests for **clock-step irrelevance**, **stale lease replay denial**, and **post-pause stale work rejection**.

No live lease service, no real clock integration, no distributed quorum/consensus protocol in this slice.

## Task A — Timer parameter contract
### Scope
Make timer assumptions explicit instead of implicit constants.

### Minimum parameters
- `suspicionTimeoutMs`
- `renewalWindowMs`
- `pauseRevalidateThresholdMs`
- `leaseGraceWindowMs`

### Rules
- parameters belong to simulation/runtime config, not hidden literals,
- authoritative logic consumes elapsed duration values from a monotonic source only,
- wall-clock timestamps remain observational only.

### Acceptance criteria
1. timer thresholds are explicit and typed,
2. authoritative paths do not depend on wall-clock deltas,
3. timer semantics are testable without real clock mutation.

## Task B — Renewal generation binding
### Scope
Bind lease/authority freshness to a monotonic renewal generation so stale lease artifacts cannot be replayed.

### Required behavior
- each current lease witness/authority artifact carries a renewal generation,
- recovery/append validates that generation against current committed/renewal state,
- stale generation is rejected even if other fields look plausible.

### Acceptance criteria
1. stale lease artifact with older generation is rejected,
2. execution-time checks validate current renewal generation,
3. renewal generation participates in authoritative append gating.

## Task C — Pause / epoch revalidation boundary
### Scope
Prevent queued/admitted work from executing after long pause or authority generation advance.

### Required behavior
- append context carries observed renewal generation,
- execution re-check compares observed vs current generation,
- large simulated pause may trigger revalidation / seal in the protected path.

### Acceptance criteria
1. post-pause stale work is denied deterministically,
2. generation advance invalidates older admitted work,
3. missing generation context fails closed.

## Task D — Deterministic test plan
### Required tests
1. **Clock-step irrelevance**
   - changing observational wall-clock values does not alter authoritative outcome.
2. **Stale lease replay denied**
   - older renewal generation cannot restore authority.
3. **Pause-triggered stale work denied**
   - work admitted before simulated long pause/generation advance is rejected.
4. **Explicit parameter surface exists**
   - timer thresholds are visible/typed in the contract.
5. **Valid fresh generation still works**
   - matching current renewal generation allows protected append path to proceed.

## Out of scope
- real monotonic clock integration,
- live lease renewal protocol,
- timer calibration tuning for production,
- distributed lease correctness,
- real multi-process race handling,
- executor side-effect atomicity.

## Definition of done
This slice is done when timer/renewal assumptions are explicit, stale lease artifacts are fenced by generation, and clock-step / pause-related stale work is rejected deterministically in simulation.

## Next Task
Lane B: implement Task A + Task B together as the smallest executable slice — explicit timer/renewal contract + renewal generation binding + deterministic stale-lease / clock-step tests.

## Non-overclaim caveat
Even after this lands, the system will still not have proven live lease correctness or partition-safe coordination. This milestone should be framed as **timer/renewal hardening**, not a production-ready lease protocol.
