# V05 per-key selective-defer fairness guard design — guidance (2026-03-15 09:30 UTC)

## Research question
What is the minimal deterministic per-key selective-defer fairness guard for fail-safe compaction (hot-key starvation detection + bounded per-key defer ceilings + fail-closed semantics)?

## Signal summary
External signal was mixed/noisy, but fairness/backpressure patterns were consistent:
- per-flow fairness prevents starvation under skew,
- queue/backlog control needs explicit per-tenant/per-key caps,
- hot-spot detection should be deterministic and auditable.

## Decision
**Adopt a per-key defer fairness guard with bounded ceilings and deterministic starvation triggers.**

## Minimal deterministic design

### 1) Per-key defer accounting
- `transitionLedgerKeyDeferCount`
- `transitionLedgerKeyDeferBudget`
- `transitionLedgerKeyDeferWithinCap`

### 2) Hot-key skew detector
- `transitionLedgerKeyDeferShare` (key deferred count / total deferred count in window)
- `transitionLedgerHotKeyThreshold` (e.g., 0.40)
- `transitionLedgerHotKeyStarvationSuspected` (bool)

### 3) Fail-closed trigger semantics
- budget exhausted for key:
  - `hard-invalid:compaction-failsafe-selective-defer-abuse:key-budget-exhausted`
- hot-key starvation suspected:
  - `hard-invalid:compaction-failsafe-selective-defer-abuse:hot-key-starvation`

## Deterministic policy
1. Per-key defer count must stay <= per-key budget.
2. If a key exceeds hot-key defer share threshold for N consecutive windows, mark starvation suspected and fail-close that compaction path.
3. Global defer-budget checks remain in place; this guard adds key-level fairness constraints.

## Suggested acceptance criteria (next implementation/verify)
- Fixture A: balanced key distribution under cap => no selective-defer trigger.
- Fixture B: single key exceeds per-key defer budget => key-budget-exhausted trigger.
- Fixture C: single key repeatedly dominates defer share above threshold => hot-key-starvation trigger.
- Markdown/json both surface key-level defer fields + starvation reason.

## Posting decision
No external post (internal fairness-hardening guidance only).
