# 136 — Dependency-Aware Replay-Release Slice (2026-03-12)

## Trigger
Heartbeat Lane A (PLAN).

## Inputs
- Verification boundary: `docs/research/RESUME-BARRIER-FRESHNESS-AUTHORITY-VERIFICATION-2026-03-12-2227.md`
- Learning note: `docs/research/QUEUE-DISCIPLINE-LEARNING-FRESHNESS-AUTHORITY-2026-03-12-2237.md`
- Red-team report: `docs/research/REDTEAM-DETERMINISTIC-REPLAY-RELEASE-CONTRACT-2026-03-12-2242.md`

## Goal
Turn the replay-release critique into the **smallest buildable dependency-aware release contract** that can distinguish causally stale resumed work from still-valid independent resumed work without pretending to solve full queue orchestration.

## Why this slice next
The resume-barrier slice already preserves quarantine and requires a matching recovery snapshot before release. The next cheap failure class is deterministic-but-wrong replay ordering: a stale item can still sit in front of a valid independent item, or present-state matching can still miss a causal invalidation.

## Smallest buildable milestone
Ship a protocol/runtime simulation slice with:
1. an explicit **release class / dependency marker** on queued work,
2. a deterministic **release decision enum** for `release | keep-quarantined | causally-stale`,
3. persisted **denial reason** for blocked items,
4. narrow tests for **stale-first-item vs valid-independent-second-item** behavior.

No live queue runner, no scheduler, no full dependency graph in this slice.

## Task A — Queued work release metadata
### Scope
Extend queued/resume work items with the minimum metadata needed to express whether current-state validation is sufficient.

### Minimum fields
- `scopeKey`
- `observedAuthorityEpoch`
- `observedRenewalGeneration`
- `observedAuthoritySource`
- `releaseClass` (`strict-order` | `independent`)
- `dependencyMarker` (optional string, required for `strict-order` when applicable)
- `queueSequence`

### Acceptance criteria
1. queued work declares whether it is safe for current-state-only release,
2. dependency-sensitive work cannot omit required dependency marker silently,
3. metadata survives restart/reload in the simulation store.

## Task B — Dependency-aware release decision
### Scope
Introduce a pure release decision helper that classifies replay candidates under one current recovery snapshot.

### Minimum outcomes
- `release`
- `keep-quarantined`
- `causally-stale`

### Rules
- `independent` work may be released when current snapshot matches preserved authority context,
- `strict-order` work may require matching dependency marker / continuity proof,
- stale-first blocked work must not force-release simply because it is first in sequence.

### Acceptance criteria
1. causally stale item is classified `causally-stale`,
2. valid independent item behind a stale item can still be classified `release`,
3. insufficient dependency context yields `keep-quarantined`, not optimistic release.

## Task C — Persisted denial reason for blocked items
### Scope
When replay candidate is denied or held, persist the reason in the quarantine/release state.

### Acceptance criteria
1. blocked item retains machine-readable reason,
2. restart preserves the last denial reason,
3. denial reason distinguishes `causally-stale` from generic quarantine.

## Task D — Deterministic test plan
### Required tests
1. **Stale first item classified causally stale**
   - strict-order item with invalidated dependency is denied as `causally-stale`.
2. **Independent second item may still release**
   - later independent item with valid snapshot is classified `release`.
3. **Missing dependency marker keeps item quarantined**
   - strict-order item without needed dependency marker is not optimistically released.
4. **Denial reason survives restart**
   - blocked item reason persists through store reload.
5. **Strict-order vs independent semantics are explicit**
   - replay strategy is declared in data, not inferred from sequence order alone.

## Out of scope
- full queue executor,
- automatic dependency graph inference,
- live queue draining,
- scheduler fairness,
- executor side-effect atomicity,
- end-to-end runtime replay orchestration.

## Definition of done
This slice is done when replay candidates carry explicit release semantics, causally stale vs merely quarantined items are distinguishable, and valid independent work no longer has to be blocked just because a stale item sits earlier in the queue.

## Next Task
Lane B: implement Task A + Task B together as the smallest executable slice — release class metadata + dependency-aware release decision helper + deterministic stale-first / independent-second tests.

## Non-overclaim caveat
Even after this lands, the system will still not have proven live queue orchestration correctness or end-to-end replay scheduling safety. This milestone should be framed as **dependency-aware replay hardening**, not a production-ready queue recovery engine.
