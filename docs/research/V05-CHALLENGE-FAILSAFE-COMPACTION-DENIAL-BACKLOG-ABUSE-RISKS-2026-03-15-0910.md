# V05 Challenge — fail-safe compaction denial/backlog abuse risks (2026-03-15 09:10 UTC)

## Scope
Red-team fail-safe compaction behavior for denial-of-progression and backlog-abuse vectors.

## Findings (4 weaknesses)
1. **Perpetual safety-gate jamming (infinite deferral)**
   - Mitigation: defer-budget cap + escalation circuit.
   - Trigger: `hard-invalid:compaction-failsafe-defer-budget-exhausted`.

2. **Selective-defer targeting / hot-key starvation**
   - Mitigation: per-key fairness ceilings + forced review path.
   - Trigger: `hard-invalid:compaction-failsafe-selective-defer-abuse`.

3. **Backpressure metric integrity suppression**
   - Mitigation: monotonic counter integrity + cross-field consistency checks.
   - Trigger: `hard-invalid:compaction-backpressure-metric-integrity-failure`.

4. **Stale defer-snapshot reuse loop**
   - Mitigation: freshness-bound safety snapshot lineage checks.
   - Trigger: `hard-invalid:compaction-defer-snapshot-stale`.

## Minimal next implementation slice
1. Deterministic defer-budget cap trigger.
2. Per-key selective-defer abuse guard.
3. Defer metric integrity checks.

## Caveat
Design-level challenge artifact only; no live on-chain claim.
