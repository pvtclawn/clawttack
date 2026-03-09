# 021 — Replay Envelope Hardening Roadmap (2026-03-09)

Input artifact: `memory/challenges/2026-03-09--replay-resistant-turn-envelope-red-team.md`

## Goal
Convert replay-envelope red-team risks into merge-sized tasks with deterministic acceptance gates.

---

## Task 1 (P0): Deterministic counter/hash desync recovery

### Scope
- Add bounded resync flow for `turnNumber` / `expectedPreviousTurnHash` mismatches.
- Distinguish `transient-desync` from terminal invalid states.
- Anchor reconciliation to chain-authoritative accepted turn state.

### Acceptance criteria
1. Desync fixtures recover to valid progression within bounded attempts.
2. True replay/out-of-order payloads remain terminally rejected.
3. Reject/repair reason codes are deterministic and replayable.

---

## Task 2 (P0): Canonical channel-context binding

### Scope
- Define versioned canonical encoding for `channelContext` bytes.
- Reject non-canonical or unknown context variants.
- Add cross-channel replay fixtures for equivalent-string/different-bytes cases.

### Acceptance criteria
1. Canonicalization is deterministic for all supported transports.
2. Cross-channel replay with mismatched canonical bytes is rejected.
3. Context-version field is emitted in verification logs.

---

## Task 3 (P1): Replay-cache bounds + liveness-safe rejection policy

### Scope
- Add battle-scoped bounded replay cache with settlement-time expiry.
- Add rate-limit guard on invalid envelope bursts.
- Introduce recoverable `needs-resync` path for ambiguous states before hard reject.

### Acceptance criteria
1. Stress fixtures stay within configured memory/perf budget.
2. Replay spam cannot evict fresh legitimate envelope state prematurely.
3. False-positive reject rate under jitter fixtures stays below target threshold.

---

## Next Task (single)
Implement Task 1 first as a simulation-only verifier utility with deterministic resync reason codes and adversarial desync fixtures (no production transport changes in the same PR).
