# Decision Guidance — V05 comparable=false markdown policy (2026-03-14 14:20 UTC)

## Context
- `comparison-latest.json` now emits machine-readable `comparable` + ordered `comparabilityReasons[]`.
- Remaining hardening gap from Lane D: prevent evaluative markdown language when `comparable=false`.

## Decision
Implement the smallest markdown-output policy slice next:
1. Add an explicit markdown section gate:
   - if `comparable=true`: allow normal comparative language,
   - if `comparable=false`: emit non-evaluative status text only.
2. Mirror JSON reason classes in markdown without interpretation inflation.
3. Keep artifact generation enabled even when non-comparable (diagnostic-first, not silent skip).

## Minimal acceptance criteria
1. With clean strict inputs: markdown shows `comparable: true` and existing comparison summary.
2. With injected contamination: markdown shows `comparable: false`, lists deterministic reason classes, and avoids evaluative phrasing (no winner/loser/delta interpretation).
3. JSON and markdown stay parity-aligned on comparability state and reasons.

## Why this now
- Highest-value remaining reliability hardening for interpretation safety.
- Keeps machine-readable contract as source of truth while reducing human review leakage.

## Caveat
- This is an output-policy hardening slice only; it does not expand strict contamination classes.
