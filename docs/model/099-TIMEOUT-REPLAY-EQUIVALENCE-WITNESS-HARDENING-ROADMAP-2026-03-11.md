# 099 — Timeout Replay-Equivalence Witness Hardening Roadmap (2026-03-11)

## Context
Task source:
- `docs/model/098-TIMEOUT-REPLAY-EQUIVALENCE-WITNESS-GATE-PLAN-2026-03-11.md`

Red-team source:
- `docs/research/TIMEOUT-REPLAY-EQUIVALENCE-WITNESS-GATE-REDTEAM-2026-03-11.md`

Goal: convert replay-equivalence witness red-team findings into constrained hardening tasks with deterministic acceptance criteria.

## Task 1 — Reducer identity/version lock + context tuple equality gate
Implement deterministic checks for:
1. authenticated reducer identity/version digest,
2. strict replay context tuple equality (`chainId|arena|operationId|reducerVersion`),
3. spoof/mismatch hard-fail path.

### Acceptance criteria
- Reducer-version spoof fixtures fail with `timeout-replay-reducer-version-invalid`.
- Context-tuple drift fixtures fail with `timeout-replay-context-mismatch`.
- Valid authenticated reducer+context tuples pass deterministically.

## Task 2 — Canonical structured trace integrity guard
Implement deterministic checks for:
1. trace canonicalization schema integrity,
2. trace-hash laundering resistance,
3. milestone parity checks before terminal-hash acceptance.

### Acceptance criteria
- Trace canonicalization laundering fixtures fail with `timeout-replay-trace-canonicalization-invalid`.
- Terminal-hash-only but milestone-divergent fixtures fail with `timeout-replay-milestone-divergence`.
- Canonical equivalent traces pass with stable artifact hash.

## Task 3 — Deterministic-input contract + nondeterministic denylist
Implement deterministic checks for:
1. nondeterministic-field denylist enforcement,
2. unstable-input detection prior to replay evaluation,
3. deterministic precondition contract for witness evaluation.

### Acceptance criteria
- Nondeterministic-field smuggling fixtures fail with `timeout-replay-nondeterministic-input`.
- Stable deterministic input fixtures avoid false positives.
- Identical tuples produce identical verdict and artifact hash.

## Next Task (single)
Lane B: implement Task 1 in `packages/protocol` (reducer identity/version lock + context tuple equality evaluator + fixtures), no runtime wiring in same slice.
