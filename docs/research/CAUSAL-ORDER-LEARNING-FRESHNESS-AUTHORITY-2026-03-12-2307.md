# Causal Order Learning — Freshness Authority Replay-Orchestration Gap (2026-03-12 23:07 UTC)

## Trigger
Heartbeat Lane E (LEARN).

## Source
- `books_and_papers/006_think_distributed_systems.pdf`
- Relevant extracted ideas:
  - causal / happens-before relationships,
  - partial order vs unnecessary total order,
  - commutativity and independence,
  - replay correctness depending on preserving the right dependencies rather than arbitrary sequence.

## Extracted lesson
The useful lesson is that **correct replay ordering is about causal order, not blanket total order**. Some operations must wait for prior state transitions because they depend on them; others are independent and can be processed without inheriting every unrelated queue blockage.

This matters because a stable total order can still be wrong if it ignores actual dependencies, while a dependency-aware partial order can preserve safety without sacrificing all liveness.

## Applied interpretation for Clawttack
Our dependency-aware replay-release slice already introduced `strict-order` vs `independent` classes. The next conceptual step is to sharpen why that split exists:
- `strict-order` work represents operations whose validity depends on specific prior authority transitions,
- `independent` work is safe under current-state validation alone,
- queue sequence by itself is not a trustworthy proxy for causal dependency.

## Concrete mechanism delta
Move from “ordered queue” thinking toward **dependency-aware partial-order replay**.

### A. Dependency marker is a causal claim
A `dependencyMarker` should mean: this work item depends on a specific authority transition or prerequisite state being present.

### B. Independent work should not inherit unrelated blockage
If a stale strict-order item is blocked for causal reasons, an unrelated independent item should still be releasable when current state matches.

### C. Missing causal context must fail closed for dependency-sensitive work
If the system cannot tell what a strict-order item depends on, it should remain quarantined rather than pretending sequence order is enough.

## Why this narrows the remaining gap
- **Safety**: causally stale work is blocked for the right reason.
- **Liveness**: independent work is not unnecessarily starved behind unrelated stale backlog.
- **Replay correctness**: ordering policy reflects actual dependency structure rather than arbitrary queue position.

## Deterministic next-step criteria
1. **Dependency marker encodes causal prerequisite**
   - strict-order item must declare what authority transition or prerequisite it depends on.
2. **Independent work may release behind blocked strict-order work**
   - unrelated valid work is not starved by stale first item.
3. **Missing causal context keeps strict-order item quarantined**
   - sequence number alone is insufficient.
4. **Causally stale classification is explicit**
   - denial reason names causal invalidation, not generic queue blockage.
5. **Replay semantics are partial-order aware**
   - strict total ordering is no longer assumed as the only safe default.

## Explicit caveat
This is still a learning/design artifact. It does not prove live scheduler correctness, automatic dependency inference, or complete causal-order preservation across the real runtime.

## Recommended next slice
Red-team and/or plan a **causal-marker replay contract** that makes dependency markers more explicit and tests whether independent work can safely bypass stale causally blocked items.
