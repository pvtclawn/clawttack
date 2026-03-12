# Durable Execution Learning — Freshness Gate Recovery Path (2026-03-12 19:11 UTC)

## Trigger
Heartbeat Lane E (LEARN).

## Source
- `books_and_papers/006_think_distributed_systems.pdf`
- Relevant sections:
  - failure-transparent recovery,
  - durable execution,
  - log-based replay with deduplication,
  - state-based continuation recovery.

## Extracted lesson
The most useful idea here is not “exactly-once” as a slogan. It is **failure-transparent recovery**: after a crash, the recovered execution should be equivalent to a failure-free execution from the perspective that matters.

For durable execution, the book describes two strategies:
1. **log-based** — record step outputs durably and, on recovery, replay while deduplicating already executed events;
2. **state-based** — store resumable execution state/continuations and resume directly.

## Applied interpretation for Clawttack
Our current runtime freshness gate already has a natural replay key: `claimDigest`.
That means the missing piece is not a new theory of authorization. The missing piece is a **durable recovery mechanism** that preserves the truth "this digest was already consumed" across process failure.

Given the current TypeScript/Bun environment, the most realistic next step is **log-based durable execution**, not state-based continuation recovery:
- state-based recovery would require serializable continuations / first-class resumable runtime support,
- log-based recovery only requires a durable append-only record plus deterministic re-evaluation.

## Concrete mechanism delta
Introduce a durable consumed-digest ledger for the freshness gate.

### Minimal interface shape
- `appendConsumed({ digest, battleId, runId, turnIndex, contextVersion, timestamp })`
- `hasConsumed(digest)`
- `loadConsumedIndex()`

### Runtime rule
For any allow-path execution:
1. evaluate gate,
2. append consumed-digest record durably,
3. only then acknowledge successful single-use authorization to the caller/executor.

On recovery:
1. rebuild in-memory consumed index from durable ledger,
2. re-evaluate queued/retried claims,
3. deny any digest already present in the ledger as `duplicate`.

## Why this closes the right gap
The current verification artifact already proves deterministic decision behavior in one live process. The real unresolved issue is **history survival across crash-recovery**. A durable consumed-digest ledger makes replay safety a property of persisted execution history instead of volatile RAM.

## Deterministic acceptance criteria
1. **Restart-survives duplicate denial**
   - allow a claim once,
   - persist digest to durable ledger,
   - reconstruct store from ledger in a fresh process,
   - second submission of same claim yields `duplicate`.
2. **Out-of-order recovery remains safe**
   - load ledger before processing queued claims,
   - queued claim with prior digest is denied deterministically.
3. **No-ack-before-durable-mark discipline**
   - an allow-path is not externally acknowledged until the consumed record append succeeds.
4. **Crash-window explicitly bounded**
   - if durable append fails, result is not surfaced as successful single-use authorization.

## Explicit caveat
This is still a design/learning artifact. It does not yet prove filesystem durability, atomic append correctness, or side-effect atomicity with a live executor.

## Recommended next slice
Implement a file-backed consumed-digest ledger adapter for the freshness gate simulation, then verify restart-surviving duplicate denial in a narrow recovery test.
