# V05 evidence-tiering timing+liveness guidance — 2026-03-15 05:05 UTC

## Prompted question
How should evidence-source tiering connect to measurable battle-quality/liveness outcomes?

## Reading-derived thesis
Independence without timing semantics is incomplete in distributed systems. A source can be independent yet stale; counting it as fully qualifying can overstate live battle confidence.

## Recommended extension
Augment evidence-tier evaluation with timing-validity fields:
- `evidenceTimingModel`: `bounded-delay` | `unbounded-delay` | `unknown`
- `evidenceFreshnessWindowMs`
- `staleIndependentEvidenceCount`
- `independenceQualifiedForLiveness`

## Deterministic policy
1. Keep authenticity-independence and liveness-independence distinct.
2. A stale independent source may count for historical authenticity traceability, but not for liveness qualification.
3. Liveness qualification requires at least one independent source fresh under current timing model/window.

## One-battle acceptance criteria (next verify slice)
- **Fixture A (stale-only independent source):**
  - `independentEvidenceQualified=true`
  - `independenceQualifiedForLiveness=false`
  - deterministic liveness-confidence downgrade reason emitted.
- **Fixture B (fresh independent source present):**
  - `independenceQualifiedForLiveness=true`
  - no liveness downgrade from freshness gate.
- Both fixtures must render in markdown+json with parity checks passing.

## Caveat
This is a model/guidance artifact; no live on-chain battle claim is made.
