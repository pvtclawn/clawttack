# V05 Challenge — strict-core closure hashing gaming risks (2026-03-15 07:10 UTC)

## Scope
Red-team `strict-core` evidence-closure compatibility mode for hidden-drift attack paths.

## Findings (4 weaknesses)
1. **Required-core downgrades to optional classification**
   - Mitigation: signed key-classification policy hash + downgrade-incompatibility rule.
   - Trigger: `hard-invalid:closure-key-classification-downgrade`.

2. **Optional-field flooding and distraction drift**
   - Mitigation: optional-drift weighted budget + escalation threshold.
   - Trigger: `hard-invalid:closure-optional-drift-budget-exceeded`.

3. **Stale schema-version pinning**
   - Mitigation: minimum schema version per ruleVersion/mode.
   - Trigger: `hard-invalid:closure-schema-version-stale`.

4. **Cross-mode core-set laundering**
   - Mitigation: bind required-core set hash to mode profile hash.
   - Trigger: `hard-invalid:closure-core-mode-binding-mismatch`.

## Minimal next implementation slice
1. Bind key-classification policy hash to closure manifest.
2. Enforce mode-bound core-set hash consistency.
3. Enforce schema-version freshness floor.

## Caveat
Design-level challenge artifact only; no live on-chain claim.
