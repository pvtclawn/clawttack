# V05 Challenge — failure-class window-allowance spoofing (2026-03-15 05:40 UTC)

## Scope
Red-team whether failure-class and delivery-semantics labels can be manipulated to gain unjustified timing-window allowances.

## Findings (4 weaknesses)
1. **Failure-class self-label spoofing**
   - Mitigation: deterministic derived class; no free-form override.
   - Trigger: `hard-invalid:failure-class-derivation-mismatch`.

2. **Retry-signal fabrication**
   - Mitigation: verifiable retry-evidence chain (same-turn linkage, monotonic counters, bounded timing).
   - Trigger: `hard-invalid:retry-evidence-unverifiable`.

3. **Permissive handling of unknown delivery semantics**
   - Mitigation: unknown semantics cannot qualify for allowance.
   - Trigger: `hard-invalid:delivery-semantics-insufficient`.

4. **Allowance stacking drift**
   - Mitigation: enforce single global cap `effectiveWindow <= modeBaseWindow * 1.20`.
   - Trigger: `hard-invalid:timing-allowance-cap-exceeded`.

## Minimal next implementation slice
1. Derived failure-class parity check.
2. Retry-evidence verification gate.
3. Non-stackable global cap check.

## Caveat
Design-level red-team artifact only; no live on-chain claim.
