# 013 — Randomized Horizon Guardrail Plan (v0)

Date: 2026-03-09
Input artifact: `memory/challenges/2026-03-09--randomized-horizon-red-team.md`

## Scope
Convert red-team concerns into a minimal, testable implementation path that can be merged incrementally without broad mechanism churn.

---

## Task 1 (P0): Stop-sampling integrity + timeout ordering invariants

### Goal
Ensure randomized termination cannot be exploited through timeout windows or predictable sequencing.

### Implementation constraints
- Stop sampling only after a **valid submitted turn** is accepted.
- No stop sampling while a turn is unresolved/pending timeout adjudication.
- Preserve hard cap semantics as deterministic fallback.

### Acceptance criteria
1. Invariant tests prove: `timeout-window => no stop sample`.
2. Invariant tests prove: `accepted-turn => exactly one stop sample event`.
3. Existing deterministic hard-cap behavior remains reachable and unchanged when random tail disabled.

---

## Task 2 (P0): Entropy source auditability envelope

### Goal
Prevent predictability/manipulation of randomized tail decisions.

### Implementation constraints
- Define explicit entropy source interface and transcript fields.
- Record sufficient data per stop decision for post-hoc verification.
- Reject sources that depend on directly controllable local process state.

### Acceptance criteria
1. Every stop decision has a reproducible audit record in battle artifacts.
2. Replay verifier can recompute stop decisions from recorded transcript data.
3. Simulation run with adversarial timing cannot improve stop prediction above baseline chance.

---

## Task 3 (P1): Anti-variance / anti-stall evaluation gate

### Goal
Ensure randomized horizon does not re-enable template EV via lottery behavior or delay abuse.

### Implementation constraints
- Add scenario suite with explicit variance-farming and stalling strategy profiles.
- Evaluate distributional outcomes, not only point win-rate.
- Treat late-turn deadline hugging as a measured signal, not ignored noise.

### Acceptance criteria
1. ResultType incidence does not regress on short-settle failures vs fixed-horizon baseline.
2. Late-turn stall concentration metric does not increase beyond predefined bound.
3. Adaptive-vs-template EV gap remains positive with confidence threshold in simulation batch.

---

## Next Task (single)
Implement **Task 1 only** behind a feature flag, with invariant tests and no economic parameter changes in the same PR.
