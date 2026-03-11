# 091 — Timeout Clock-Source Consistency Hardening Roadmap (2026-03-11)

## Context
Task source:
- `docs/model/090-TIMEOUT-CLOCK-SOURCE-CONSISTENCY-GATE-PLAN-2026-03-11.md`

Red-team source:
- `docs/research/TIMEOUT-CLOCK-SOURCE-CONSISTENCY-REDTEAM-2026-03-11.md`

Goal: convert clock-source consistency red-team findings into constrained hardening tasks with deterministic acceptance criteria.

## Task 1 — Monotonic provenance lock + mixed-source ordering guard
Implement deterministic checks for:
1. provenance-bound monotonic stream validity,
2. mixed-source ordering invalidation (monotonic/wall-clock cross-use rejection),
3. same-source ordering integrity.

### Acceptance criteria
- Forged monotonic stream fixtures fail with `timeout-clock-source-provenance-invalid`.
- Mixed-source ordering fixtures fail with `timeout-clock-source-mixed-ordering-invalid`.
- Valid same-source monotonic traces pass with deterministic artifact hash.

## Task 2 — Sync-proof authenticity + cross-node uncertainty discipline
Implement deterministic checks for:
1. synchronization-proof authenticity/freshness,
2. mandatory uncertainty downgrade when sync proof is stale/untrusted,
3. anti-laundering of pseudo-sync metadata.

### Acceptance criteria
- Stale/forged sync-proof fixtures fail with `timeout-clock-source-sync-proof-invalid`.
- Cross-node wall-clock-only traces return `timeout-clock-source-cross-node-uncertain`.
- Trusted/fresh sync-proof traces avoid false uncertainty.

## Task 3 — Rollover regression + coverage completeness guard
Implement deterministic checks for:
1. rollover boundary regression detection,
2. required-source coverage completeness,
3. anti-omission handling for uncertainty suppression attempts.

### Acceptance criteria
- Boundary regression fixtures fail with `timeout-clock-source-rollover-regression`.
- Selective sample omission fixtures fail with `timeout-clock-source-coverage-incomplete`.
- Complete, non-regressing traces pass deterministically.

## Next Task (single)
Lane B: implement Task 1 in `packages/protocol` (monotonic provenance + mixed-source ordering evaluator + fixtures), no runtime wiring in same slice.
