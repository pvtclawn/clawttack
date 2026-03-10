# 083 — Verification-Claim Membership-Epoch Counter Hardening Roadmap (2026-03-10)

## Context
Task-1 membership-epoch counter plan exists (`082`) and fresh red-team findings identified five abuse vectors:
- replay-window laundering,
- counter-reset spoofing,
- burst-splitting gap-policy gaming,
- cross-scope counter collision,
- parallel acceptance race conflicts.

Goal for this roadmap: convert those findings into constrained, merge-sized tasks with deterministic acceptance gates.

## Task 1 — Freshness floor + monotonic counter floor lock
Implement deterministic checks in protocol tooling for:
1. stale-window rejection,
2. per-scope monotonic floor persistence (`claimId+epochId+authoritySetId`),
3. regression/reset detection.

### Acceptance criteria
- Replay-window fixture fails with `membership-epoch-counter-stale-window`.
- Reset/regression fixture fails with `membership-epoch-counter-reset-detected`.
- Strictly monotonic in-window counter passes with `membership-epoch-counter-pass`.
- Identical tuples produce identical verdict + artifact hash.

## Task 2 — Cumulative-gap + scope-canonicalization guard
Add rolling cumulative-gap budget and canonical-scope binding.

### Acceptance criteria
- Burst-splitting fixture fails cumulative budget with `membership-epoch-counter-cumulative-gap`.
- Non-canonical/aliased scope fixture fails with `membership-epoch-counter-scope-mismatch`.
- Canonical scope + policy-compliant progression passes deterministically.

## Task 3 — Concurrent acceptance conflict reducer
Add deterministic conflict handling for parallel candidate acceptance paths.

### Acceptance criteria
- Parallel-branch race fixture fails with `membership-epoch-counter-concurrent-conflict` unless single winning branch established by deterministic reducer.
- Reordered equivalent evidence sets resolve to same winner/verdict.
- Conflict outcomes are replay-stable (artifact-hash stable).

## Next Task (single)
Lane B: implement Task 1 in `packages/protocol` as simulation/tooling evaluator + fixtures (freshness floor + monotonic floor lock), no publish-path wiring in same slice.
