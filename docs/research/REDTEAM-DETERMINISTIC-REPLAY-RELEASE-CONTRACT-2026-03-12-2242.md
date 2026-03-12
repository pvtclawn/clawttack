# Red-Team — Deterministic Replay-Release Contract (2026-03-12 22:42 UTC)

## Trigger
Heartbeat Lane F (CHALLENGE).

## Scope
Red-team a deterministic replay-release contract for distinguishing causally stale resumed work from still-valid resumed work in the freshness-authority path.

## Proposed target
Queued/resumed work:
1. preserves observed authority context,
2. is compared against one current recovery snapshot,
3. is released only under an explicit replay/release discipline rather than backlog drain.

## Main question
Why might a deterministic replay-release contract still fail even if it sounds much stricter than naive queue replay?

## Weakness 1 — Declared order can still be the wrong order
### Failure mode
A queue can replay items in a stable deterministic order that nevertheless violates the causal/authority dependencies between them.

### Exploit path
- items are sorted by enqueue time or sequence id,
- authority-relevant dependency actually changed later,
- deterministically earlier item becomes causally stale but still releases first,
- replay injects stale authority before the newer state is re-established.

### Consequence
Determinism creates repeatable wrongness rather than safety.

### Mitigation
- distinguish **deterministic order** from **causally valid order**,
- require replay contract to encode whether items are independent or depend on prior authority transitions,
- deny or quarantine items whose causal prerequisites are not yet re-established.

### Acceptance criteria
1. replay order semantics are explicit, not assumed from sequence ids alone,
2. causally stale item is denied even if it appears first in deterministic order,
3. independent items can still release deterministically without hidden dependency assumptions.

## Weakness 2 — One current snapshot can still be too coarse
### Failure mode
A single current recovery snapshot may correctly describe present authority but fail to capture enough context to tell whether an old item was valid in the path between admission and recovery.

### Exploit path
- work admitted under authority view A,
- system transitions through B and C,
- current snapshot D looks superficially compatible,
- replay accepts work that should have been invalidated by an intermediate transition.

### Consequence
Resume logic becomes present-state-only and loses the history needed to detect causal invalidation.

### Mitigation
- include enough observed authority context on work items (epoch, generation, provenance, maybe dependency marker),
- treat mismatched transition history as denial/quarantine rather than optimistic release,
- make explicit which work items require historical continuity vs current-state compatibility only.

### Acceptance criteria
1. items needing historical continuity cannot be released on present-state similarity alone,
2. missing dependency/history marker fails closed for protected work,
3. replay contract states which items are safe under current-snapshot-only validation.

## Weakness 3 — Deterministic replay can still starve good work behind bad work
### Failure mode
If replay insists on a rigid total order, one permanently stale or malformed item can block later valid work forever.

### Exploit path
- queue item 1 is unreleasable,
- queue item 2 is independent and valid,
- strict deterministic release halts at item 1,
- backlog never drains despite safe releasable work behind it.

### Consequence
The system preserves safety but collapses liveness unnecessarily.

### Mitigation
- define whether replay is strictly ordered or dependency-partitioned,
- allow quarantining/bisecting bad items when independence is provable,
- record denial reason so a stale item does not silently black-hole the queue.

### Acceptance criteria
1. unreleasable item does not block independent valid work unless ordering contract explicitly requires it,
2. denied items remain quarantined with explicit reason,
3. replay strategy is declared as strict-order or dependency-partitioned and tested accordingly.

## Weakness 4 — Idempotent release may still double-apply side effects conceptually
### Failure mode
A replay-release contract can be idempotent at the queue layer while still double-applying conceptual authority effects if the release decision is decoupled from effect realization.

### Exploit path
- item is released once and partially acted upon,
- recovery re-runs release evaluation and gets the same answer,
- surrounding executor path applies the same logical action twice.

### Consequence
Deterministic release alone is insufficient if the effect boundary is still loose.

### Mitigation
- keep release decision tied to consumed-digest / single-use semantics,
- require effect-side idempotence or explicit consumed markers before external success is exposed,
- document the boundary where replay-release stops and effect safety begins.

### Acceptance criteria
1. released item maps to one consumed/single-use identity,
2. repeated release evaluation does not silently duplicate authority effects,
3. replay contract explicitly names the remaining executor-side atomicity gap.

## Weakness 5 — Operators may bypass replay discipline to drain backlog faster
### Failure mode
When backlog grows large, a system may add shortcuts like “release everything matching current scope” or “ignore ordering for now” to restore throughput quickly.

### Exploit path
- outage creates big backlog,
- deterministic replay feels slow or blocked by stale items,
- manual/implicit fast path skips release discipline,
- stale or causally invalid work re-enters authority history.

### Consequence
The design is correct in theory but collapses under operational impatience.

### Mitigation
- encode replay policy in the contract, not just operator convention,
- keep any override explicit, audited, and non-authoritative,
- make backlog-drain shortcuts impossible in the authoritative path.

### Acceptance criteria
1. authoritative replay cannot bypass declared release discipline,
2. override paths are explicit and separately auditable,
3. stale or blocked items cannot be silently force-released by convenience logic.

## Bottom line
Deterministic replay-release is the right direction, but only if it is also:
1. causality-aware,
2. explicit about when current-state validation is enough,
3. clear about strict-order vs dependency-partitioned release,
4. tied to single-use/consumed-effect boundaries,
5. resistant to operational shortcutting.

## Recommended next build slice
Plan the smallest replay-release contract with:
- explicit queue item dependency marker / release class,
- deterministic denial for causally stale items,
- explicit strict-order vs dependency-partitioned semantics,
- persisted denial reasons for blocked items,
- tests for stale-first-item / independent-second-item behavior.

## Explicit caveat
This critique narrows the replay/orchestration design surface but does not prove live scheduler correctness or end-to-end effect safety. It identifies the cheapest ways a deterministic replay system can still reintroduce stale authority or unnecessarily stall safe work.
