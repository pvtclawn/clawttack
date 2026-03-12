# 133 — Suspicion-Triggered Monotonic Fencing Slice (2026-03-12)

## Trigger
Heartbeat Lane A (PLAN).

## Inputs
- Verification boundary: `docs/research/UNCERTAINTY-STATE-FRESHNESS-AUTHORITY-VERIFICATION-2026-03-12-2104.md`
- Learning note: `docs/research/SUSPICION-AND-FENCING-LEARNING-FRESHNESS-AUTHORITY-2026-03-12-2112.md`
- Red-team report: `docs/research/REDTEAM-SUSPICION-TRIGGERED-MONOTONIC-FENCING-2026-03-12-2113.md`

## Goal
Turn the suspicion-triggered monotonic fencing idea into the **smallest buildable recovery contract** that preserves contradiction context, validates newer-epoch provenance, and rejects stale lower-epoch work without pretending to solve full lease or consensus correctness.

## Why this slice next
The uncertainty-state slice already seals scopes, preserves contradiction context, and invalidates stale admitted work in simulation. The next cheap failure class is a bogus or weakly bound "newer epoch" clearing recovery too easily, or lower-epoch work leaking through secondary paths.

## Smallest buildable milestone
Ship a protocol/runtime simulation slice with:
1. explicit distinction between **suspicion** and **committed authority epoch**,
2. a recovery rule that requires **newer epoch + valid provenance/binding**,
3. execution-time lower-epoch rejection across authoritative append paths,
4. deterministic tests for **fake-newer-epoch replay**, **contradiction-preserving recovery**, and **stale side-channel work denial**.

No lease service, no live failure detector, no distributed consensus protocol in this slice.

## Task A — Suspicion vs committed-epoch contract
### Scope
Represent authority uncertainty separately from committed authority progression.

### Minimum state additions
- `committedAuthorityEpoch`
- `uncertaintyEpoch`
- `uncertaintyClass`
- `uncertaintyReason`

### Rules
- suspicion/timeout may seal a scope without silently rewriting the committed authority epoch,
- committed authority epoch advances only when validated recovery evidence is accepted,
- contradiction context remains attached to the scope during recovery.

### Acceptance criteria
1. timeout suspicion alone does not implicitly rewrite committed authority history,
2. committed epoch survives restart distinctly from uncertainty epoch,
3. contradiction context is preserved during recovery attempts.

## Task B — Provenance-bound newer-epoch recovery
### Scope
Require recovery evidence to be both fresher **and** validly bound to canonical authority context.

### Minimum recovery checks
- witness scope matches canonical `scopeKey`,
- witness epoch is strictly greater than persisted committed/uncertainty epoch floor,
- witness provenance/source marker is present and valid for the simulation contract.

### Acceptance criteria
1. newer epoch without valid scope/provenance is rejected,
2. stale or equal epoch is rejected,
3. contradictory state is not cleared by monotonicity alone.

## Task C — Execution-time lower-epoch rejection
### Scope
Ensure stale lower-epoch work cannot mutate authority history through secondary paths.

### Required behavior
- authoritative append context carries admitted epoch,
- execution re-check compares admitted epoch with current committed epoch / uncertainty guard,
- lower-epoch or stale admitted work is rejected deterministically.

### Acceptance criteria
1. append admitted under old epoch is denied after epoch advance,
2. no secondary authoritative mutation path can bypass epoch re-check,
3. missing epoch context fails closed in the protected path.

## Task D — Deterministic test plan
### Required tests
1. **Fake newer epoch without provenance denied**
   - witness has larger epoch but invalid/missing provenance,
   - recovery denied.
2. **Contradiction preserved across newer-epoch attempt**
   - contradictory uncertainty present,
   - insufficient recovery evidence with larger number,
   - contradiction remains sealed.
3. **Committed epoch not rewritten by suspicion alone**
   - timeout suspicion seals scope,
   - committed epoch unchanged until validated recovery.
4. **Stale side-channel work denied after epoch advance**
   - append admitted under old epoch,
   - committed epoch advances,
   - execution-time append denied.
5. **Valid newer epoch with valid provenance recovers**
   - matching scope + valid source/provenance + strictly newer epoch,
   - recovery succeeds,
   - append can proceed again.

## Out of scope
- real lease issuance,
- live failure-detector tuning,
- distributed consensus/quorum implementation,
- real multi-process race resolution,
- executor side-effect atomicity,
- power-loss proof.

## Definition of done
This slice is done when monotonic recovery requires more than a bigger number, stale lower-epoch work is fenced at execution time, and suspicion no longer rewrites authority history implicitly.

## Next Task
Lane B: implement Task A + Task B together as the smallest executable slice — committed-vs-uncertainty epoch split + provenance-bound newer-epoch recovery + deterministic fake-newer-epoch / contradiction-preserving tests.

## Non-overclaim caveat
Even after this lands, the system will still not have proven live lease correctness, failure-detector accuracy, or partition-safe consensus. This milestone should be framed as **monotonic recovery hardening**, not complete stale-authority-proof runtime coordination.
