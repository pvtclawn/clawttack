# Queue Discipline Learning — Freshness Authority Replay / Queue-Orchestration Gap (2026-03-12 22:37 UTC)

## Trigger
Heartbeat Lane E (LEARN).

## Source
- `books_and_papers/006_think_distributed_systems.pdf`
- Relevant extracted ideas:
  - durable execution via log-based replay,
  - idempotent recovery instead of wishful exactly-once,
  - state/history revalidation before resuming prior work,
  - correctness depends on replay discipline, not mere persistence.

## Extracted lesson
The useful lesson is that **durable replay needs queue discipline**. A persisted backlog is not itself a safe recovery mechanism. When a runtime resumes, the system needs a deliberate release order and a revalidation boundary so previously admitted work is replayed only under the current authoritative state.

In other words: durable queues preserve work, but only disciplined replay preserves correctness.

## Applied interpretation for Clawttack
Our resume-barrier freshness-authority slice already added persisted quarantine state and provenance-aware release checks. The remaining live queue-orchestration gap is the next layer up:
- queued work may be numerous,
- some items may be older or causally stale,
- some may have been admitted under authority views that no longer coexist safely,
- naive backlog draining can still reintroduce stale authority even if each item is persisted.

## Concrete mechanism delta
Treat queue replay as an explicit release discipline, not an incidental consequence of restart.

### A. Preserve observed authority context on queued work
Each queued item should keep:
- observed authority epoch,
- observed renewal generation,
- observed authority source,
- canonical scope key,
- optional queue sequence / release order marker.

### B. Release against one current recovery snapshot
Resume release should compare queued items against one authoritative current snapshot and release only items that still match the current authority boundary.

### C. Release ordering should be explicit and deterministic
Do not drain arbitrarily. Release should either:
- respect preserved ordering/sequence semantics, or
- make it explicit that items are independent and idempotent enough to release in any order.

## Why this narrows the remaining live gap
- **Recovery correctness**: stale items are not revived merely because they survived disk.
- **Queue discipline**: authoritative re-entry becomes controlled rather than opportunistic.
- **Backlog safety**: correctness can survive restart without pretending all persisted work is equally safe to resume.

## Deterministic next-step criteria
1. **Queued work preserves observed authority context**
   - authority epoch/generation/source survive restart with the work item.
2. **Release uses one current recovery snapshot**
   - work matching no current snapshot is denied or stays quarantined.
3. **Release order is explicit**
   - queue replay semantics are declared and testable, not accidental.
4. **Backlog drain is not implicit**
   - recovery does not auto-release all persisted work.
5. **Idempotent release remains safe**
   - repeated release evaluation does not mutate authority history incorrectly.

## Explicit caveat
This is still a learning/design artifact. It does not prove live queue orchestration correctness, causal ordering completeness, or real runtime scheduler behavior.

## Recommended next slice
Red-team and/or plan a **deterministic replay-release contract** that adds queue sequence/order semantics and tests causal-stale vs still-valid resumed work.
