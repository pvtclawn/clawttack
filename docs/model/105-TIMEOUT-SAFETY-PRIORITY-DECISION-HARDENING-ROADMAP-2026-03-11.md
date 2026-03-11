# 105 — Timeout Safety-Priority Decision Hardening Roadmap (2026-03-11)

## Context
Task source:
- `docs/model/104-TIMEOUT-SAFETY-PRIORITY-DECISION-GATE-PLAN-2026-03-11.md`

Red-team source:
- `docs/research/TIMEOUT-SAFETY-PRIORITY-DECISION-GATE-REDTEAM-2026-03-11.md`

Goal: convert safety-priority decision red-team findings into constrained hardening tasks with deterministic acceptance criteria.

## Task 1 — Risk/Confidence provenance integrity + anti-inflation guard
Implement deterministic checks for:
1. risk-score provenance integrity,
2. correlation-aware confidence de-duplication/caps,
3. laundering/inflation hard-fail paths.

### Acceptance criteria
- Risk-score laundering fixtures fail with `timeout-safety-risk-score-invalid`.
- Confidence inflation fixtures fail with `timeout-safety-confidence-inflated`.
- Provenance-valid, de-duplicated confidence inputs pass deterministically.

## Task 2 — Contradiction visibility + required-source coverage lock
Implement deterministic checks for:
1. required-source coverage completeness,
2. contradiction visibility enforcement,
3. masking/omission hard-fail paths.

### Acceptance criteria
- Contradictory-source masking fixtures fail with `timeout-safety-contradiction-hidden`.
- Missing required-source fixtures fail with deterministic coverage violation.
- Complete, contradiction-consistent evidence sets pass with stable artifact hash.

## Task 3 — Hold-bypass proof + policy-version freshness binding
Implement deterministic checks for:
1. hold-bypass override proof requirement,
2. policy threshold digest/version binding,
3. stale policy replay rejection.

### Acceptance criteria
- Hold-bypass abuse fixtures fail with `timeout-safety-hold-bypass-invalid`.
- Threshold replay fixtures fail with `timeout-safety-threshold-version-stale`.
- Fresh policy-bound overrides with valid proof pass deterministically.

## Next Task (single)
Lane B: implement Task 1 in `packages/protocol` (risk/confidence provenance + anti-inflation evaluator + fixtures), no runtime wiring in same slice.
