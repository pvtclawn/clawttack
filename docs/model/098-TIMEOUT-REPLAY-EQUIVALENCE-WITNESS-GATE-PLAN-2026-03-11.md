# 098 — Timeout Replay-Equivalence Witness Gate Plan (2026-03-11)

## Context
Order-equivalence validation currently compares constraints/buckets, but it can still miss semantic divergence if two candidate orders look valid yet produce different downstream classification traces.

Replication insight:
- deterministic state machines should converge under equivalent operation logs,
- log-based replication validates behavior by replaying operation sequences,
- equivalent histories should produce equivalent terminal state under deterministic replay.

## Objective
Add deterministic replay-equivalence witness checks for timeout histories so equivalence claims are backed by reducer-level behavioral convergence.

## Task (single, merge-sized)
Implement simulation/tooling evaluator for replay-equivalence witnesses:
- deterministic outcomes:
  - `timeout-replay-equivalent`
  - `timeout-replay-divergent`
  - `timeout-replay-nondeterministic-input`

## Inputs
- two candidate normalized timeout histories,
- deterministic reducer signature/version,
- reducer input context tuple,
- optional expected terminal-hash target.

## Core rules
1. Replay both candidate histories through the same deterministic reducer.
2. If terminal state hash and decision trace hash match, emit `timeout-replay-equivalent`.
3. If traces/states diverge, emit `timeout-replay-divergent`.
4. If candidate inputs violate determinism preconditions (unstable fields, missing canonicalization), emit `timeout-replay-nondeterministic-input`.
5. Identical tuples must yield identical verdict + artifact hash.

## Acceptance criteria
1. Equivalent-history fixtures pass `timeout-replay-equivalent` with matching terminal/trace hashes.
2. Divergent-history fixtures fail `timeout-replay-divergent`.
3. Nondeterministic-input fixtures fail `timeout-replay-nondeterministic-input`.
4. Identical tuples produce deterministic verdict and artifact hash.

## Non-goals
- No runtime reducer replacement in this slice.
- No on-chain schema changes in this slice.

## Next Task
Lane F: red-team replay-equivalence witness gate for reducer-version spoofing, trace-hash laundering, and nondeterministic-field smuggling.
