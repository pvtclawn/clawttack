# V05 Challenge — bounded epoch-transition window gaming risks (2026-03-15 08:10 UTC)

## Scope
Red-team bounded epoch-transition anti-replay controls for spoof/replay/oscillation bypasses.

## Findings (4 weaknesses)
1. **Carryover-digest scope forgery**
   - Mitigation: bind carryover digest to full required lineage manifest hash.
   - Trigger: `hard-invalid:anchor-transition-carryover-scope-mismatch`.

2. **Transition-id replay across context**
   - Mitigation: scoped uniqueness + one-time consumption ledger for transition IDs.
   - Trigger: `hard-invalid:anchor-transition-id-replay`.

3. **Window-edge oscillation abuse**
   - Mitigation: cumulative drift budget + hysteresis escalation.
   - Trigger: `hard-invalid:anchor-transition-window-oscillation`.

4. **Chained micro-transition laundering**
   - Mitigation: aggregate displacement cap over rolling transition horizon.
   - Trigger: `hard-invalid:anchor-transition-aggregate-displacement-exceeded`.

## Minimal next implementation slice
1. Carryover-scope binding hash check.
2. Scoped transition-id anti-replay ledger.
3. Aggregate displacement guard.

## Caveat
Design-level challenge artifact only; no live on-chain claim.
