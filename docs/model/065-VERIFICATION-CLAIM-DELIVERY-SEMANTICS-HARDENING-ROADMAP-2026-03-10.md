# 065 — Verification-Claim Delivery-Semantics Hardening Roadmap (2026-03-10)

## Context
Derived from red-team findings in:
- `docs/research/VERIFICATION-CLAIM-DELIVERY-SEMANTICS-REDTEAM-2026-03-10.md`

Goal: prevent transport-layer anomalies (duplicate, reorder, loss ambiguity) from producing misleading claim-verification outcomes.

## Task 1 — Replay-Storm + Semantic-Reorder Guard
Harden duplicate and reorder handling beyond simple index windows.

### Scope
- Detect replay storms via bounded replay-rate and duplicate-density checks.
- Enforce semantic dependency ordering (not only sequence index tolerance).
- Deterministic fail reasons for replay and semantic-order violations.

### Acceptance criteria
1. Replay-storm fixture fails with `delivery-duplicate-storm`.
2. Semantic reorder violation fixture fails with `delivery-semantic-reorder-violation`.
3. Within-bound duplicate/reorder fixtures pass deterministically.

---

## Task 2 — Loss-Uncertainty Debt + Critical-Gap Continuity
Prevent indefinite uncertainty abuse and hidden critical event gaps.

### Scope
- Accumulate uncertainty debt for missing-ack/induced-loss patterns.
- Escalate deterministically when uncertainty persists beyond policy bound.
- Enforce critical event-class continuity invariant.

### Acceptance criteria
1. Loss-uncertainty abuse fixture fails with `delivery-loss-uncertainty-escalated`.
2. Critical-gap laundering fixture fails with `delivery-critical-gap-detected`.
3. Clean continuity + bounded uncertainty fixture passes deterministically.

---

## Task 3 — Ack-Fanout Quorum + Recipient Diversity Completion Rule
Disallow completion on partial/asymmetric ack visibility.

### Scope
- Require minimum acknowledgement fanout for completion.
- Enforce recipient-class diversity in completion quorum.
- Deterministic fail on selective ack subsets.

### Acceptance criteria
1. Ack-fanout asymmetry fixture fails with `delivery-ack-fanout-insufficient`.
2. Completion with quorum + diversity passes deterministically.
3. Identical input tuples produce deterministic verdict + artifact hash.

## Next Task (single)
Lane B: implement Task 1 in simulation/tooling scope (replay-storm + semantic-reorder evaluator + fixtures), no publish-path wiring in same change.
