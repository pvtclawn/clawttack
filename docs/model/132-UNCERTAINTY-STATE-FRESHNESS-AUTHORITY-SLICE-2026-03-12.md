# 132 — Uncertainty-State Freshness Authority Slice (2026-03-12)

## Trigger
Heartbeat Lane A (PLAN).

## Inputs
- Verification boundary: `docs/research/REFUSAL-FIRST-FRESHNESS-AUTHORITY-VERIFICATION-2026-03-12-2033.md`
- Learning note: `docs/research/FAIL-STOP-LEARNING-FRESHNESS-AUTHORITY-2026-03-12-2042.md`
- Red-team report: `docs/research/REDTEAM-UNCERTAINTY-TRIGGERED-SEAL-CONTRACT-2026-03-12-2047.md`

## Goal
Turn the uncertainty-triggered seal idea into the **smallest buildable uncertainty-state contract** that keeps contradiction context, prevents stale admitted work from slipping through, and avoids fail-open authority recovery in simulation.

## Why this slice next
The sealed-state authority slice already proves basic refusal and fresh-witness unseal in local simulation. The next cheap failure class is losing the *reason* for uncertainty, or allowing append work admitted before the seal to keep executing after uncertainty appears.

## Smallest buildable milestone
Ship a protocol/runtime simulation slice with:
1. explicit **uncertainty classes**,
2. persisted uncertainty metadata alongside seal state,
3. an **uncertainty epoch / seal generation** carried through append execution,
4. deterministic tests for **conflicting evidence**, **restart-preserved uncertainty**, and **stale admitted work invalidation**.

No live failure detector, no network partition simulator, no distributed consensus protocol in this slice.

## Task A — Uncertainty-state contract
### Scope
Extend sealed authority state to preserve structured uncertainty context instead of only a boolean seal.

### Minimum fields
- `scopeKey`
- `sealed: boolean`
- `uncertaintyClass` (`missing`, `stale`, `conflicting`, `scope-mismatch`, `epoch-regression`, `timeout-suspected`)
- `lastAuthorityEpoch`
- `uncertaintyEpoch`
- `sealedAt`

### Rules
- uncertainty class must survive restart,
- contradictory evidence must not collapse into generic missing-witness state,
- scope and epoch metadata must remain bound to the same canonical scope key used by append authority.

### Acceptance criteria
1. persisted sealed state retains uncertainty class and epoch metadata,
2. conflicting evidence is distinguishable from missing evidence after restart,
3. wrong-scope or epoch-regression evidence is not normalized away.

## Task B — Fresh-proof recovery contract
### Scope
Unseal requires evidence that resolves the recorded uncertainty class, not just any witness-shaped object.

### Required behavior
- stale witness cannot clear `conflicting` / `epoch-regression` uncertainty,
- witness must match canonical scope,
- fresh authority epoch must exceed the persisted uncertainty epoch / last authority epoch.

### Acceptance criteria
1. stale or generic witness cannot unseal contradictory state,
2. wrong-scope witness cannot unseal,
3. fresh matching witness clears only the matching scope.

## Task C — Execution-time stale-admitted-work invalidation
### Scope
Prevent append work admitted before a seal transition from executing after uncertainty appears.

### Required behavior
- append execution context carries the current uncertainty epoch or seal generation seen at admission,
- append re-checks against current seal/uncertainty epoch before durable write,
- mismatch invalidates stale admitted work deterministically.

### Acceptance criteria
1. append admitted before seal transition is denied at execution if uncertainty epoch advanced,
2. queued stale work is invalidated deterministically,
3. append without current uncertainty epoch proof fails closed in protected path.

## Task D — Deterministic test plan
### Required tests
1. **Conflicting evidence survives restart**
   - seal with `conflicting` uncertainty,
   - restart,
   - persisted state still records `conflicting`.
2. **Generic witness cannot clear contradictory state**
   - sealed on `conflicting` or `epoch-regression`,
   - stale/generic witness presented,
   - unseal denied.
3. **Stale admitted work denied after seal transition**
   - append admission captures old uncertainty epoch,
   - scope seals / epoch advances,
   - execution-time append denied.
4. **Fresh matching witness clears state**
   - matching scope + fresh epoch/witness,
   - unseal succeeds,
   - append can proceed again.
5. **No implicit fail-open fallback**
   - uncertainty context present but insufficient proof supplied,
   - authoritative append remains denied.

## Out of scope
- real timeout calibration,
- live network partition simulator,
- distributed consensus/quorum implementation,
- real multi-process race resolution,
- executor side-effect atomicity,
- power-loss proof.

## Definition of done
This slice is done when uncertainty is represented as structured persisted state, stale admitted append work is invalidated deterministically, and the recovery contract no longer erases contradiction context.

## Next Task
Lane B: implement Task A + Task C together as the smallest executable slice — uncertainty-state persistence + uncertainty epoch invalidation for append execution + deterministic conflicting-evidence / stale-admitted-work tests.

## Non-overclaim caveat
Even after this lands, the system will still not have proven live partition safety or real failure-detector correctness. This milestone should be framed as **uncertainty-state hardening**, not full partition-safe runtime coordination.
