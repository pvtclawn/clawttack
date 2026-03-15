# V05 mode-specific timing-window profile guidance — 2026-03-15 05:30 UTC

## Research question
Should timing-window profile values be mode-specific (`script-vs-script`, `agent-vs-script`, `agent-vs-agent`) instead of one global default?

## Signal quality
External results were mixed/noisy, but consistent reliability pattern appears across distributed/performance practice:
- timeout/latency budgets should be workload-class aware,
- default static values drift and misclassify behavior as systems evolve,
- profile governance matters more than ad hoc per-run overrides.

## Decision
**Yes: use mode-specific timing-window profiles.**

A single global window risks both:
1. over-strict gating (false liveness downgrades in higher-latency agent modes),
2. under-strict gating (stale evidence passing in lower-latency script modes).

## Proposed profile baseline (initial conservative defaults)
- `script-vs-script`: `180000` ms
- `agent-vs-script`: `300000` ms
- `agent-vs-agent`: `420000` ms

These are policy defaults, not claims of optimality; tune only through measured evidence artifacts.

## Deterministic policy rules
1. `evidenceFreshnessWindowMs` is selected by battle mode profile, never free-form at run level.
2. Any mismatch between derived profile window and reported window remains hard-invalid (`timing-window-profile-mismatch`).
3. Mode must be included in rule-hash input so profile changes are auditable and comparable.

## Next-slice acceptance criteria
- Fixture A (`script-vs-script`, reported=300000) hard-invalids (expected 180000).
- Fixture B (`agent-vs-script`, reported=300000) passes window-profile match.
- Fixture C (`agent-vs-agent`, reported=300000) hard-invalids (expected 420000).
- Markdown/json both render mode + expected window + reported window.

## Caveat
This is guidance-level calibration logic; no live on-chain claim is made here.
