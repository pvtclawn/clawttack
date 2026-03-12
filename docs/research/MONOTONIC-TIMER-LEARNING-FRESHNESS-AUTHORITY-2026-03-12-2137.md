# Monotonic Timer Learning — Freshness Authority Lease / Timer Gap (2026-03-12 21:37 UTC)

## Trigger
Heartbeat Lane E (LEARN).

## Source
- `books_and_papers/006_think_distributed_systems.pdf`
- Relevant extracted ideas:
  - physical clocks suffer skew/drift,
  - time-of-day clocks may move backward under synchronization,
  - monotonic clocks do not move backward (within a component),
  - timeout suspicion is only a signal, not proof.

## Extracted lesson
The practical lesson is: **timeouts and lease windows should be measured with monotonic local time, not wall-clock time**. A time-of-day clock may jump backward or forward during synchronization, which can make stale actors appear fresh or trigger bogus lease conclusions.

This matters because safety decisions about whether a node should keep acting are local duration questions, not global timestamp-truth questions. The book’s distinction between time-of-day and monotonic clocks makes that explicit.

## Applied interpretation for Clawttack
Our freshness-authority design already treats epochs/fencing as the durable authority boundary. The remaining live lease gap is therefore not "sync clocks better." It is making sure that any future witness timeout, lease expiry, or renewal policy:
- measures duration using a monotonic clock,
- never trusts wall-clock timestamps as authoritative freshness proof,
- uses epochs/fencing to reject stale authority after timer-based suspicion triggers protective action.

## Concrete mechanism delta
Introduce a timer discipline rule for any future live lease/witness implementation:

### A. Monotonic clocks for local lease timing
- suspicion timeout,
- lease renewal deadline,
- lease expiry grace window,
- retry/backoff windows tied to authority refresh.

### B. Wall clock only for observability
- logs,
- debug traces,
- human-readable event timelines.

### C. Authority safety remains epoch-based
- timeout may trigger seal/suspicion,
- but authority recovery and stale-authority exclusion still require monotonic epoch progression,
- wall-clock freshness claims never override fencing.

## Why this narrows the remaining live lease gap
- **Clock adjustment resilience**: local synchronization cannot make stale authority look fresh.
- **Timer correctness**: lease expiry and suspicion are based on elapsed duration, not drift-prone timestamps.
- **Recovery discipline**: epochs stay as the hard authority rule even when timers are noisy.

## Deterministic next-step criteria
1. **Timeout logic uses monotonic duration source**
   - no authoritative decision path depends on wall-clock deltas.
2. **Wall-clock timestamps are observational only**
   - logs may record them, but recovery/append logic ignores them for authority truth.
3. **Timer-triggered suspicion does not override fencing**
   - even if timeout fires, stale authority remains governed by epoch/provenance checks.
4. **Clock-step simulation cannot revive stale authority**
   - local clock change in either direction does not permit lower/stale authority to regain append rights.

## Explicit caveat
This is still a learning/design artifact. It does not prove real lease implementation correctness, timer calibration, or live failure-detector accuracy.

## Recommended next slice
Red-team and/or plan a **monotonic-timer lease contract** that explicitly forbids wall-clock freshness checks in authoritative paths and tests clock-step resilience in simulation.
