# V05 Challenge — model-layer authenticity gaming risks (2026-03-15 04:40 UTC)

## Scope
Red-team proposed model-layer authenticity additions:
- `authenticityModelQuality`
- local-vs-global provenance split
- `authenticityCausalChain`

## Findings (4 weaknesses)

1. **Schema-complete but trust-incomplete evidence**
- Risk: all required fields can come from one untrusted producer and still pass superficial completeness.
- Mitigation: require independent evidence-source diversity (`>=2` sources, including one external to move producer).
- Deterministic test: single-source fixture forces `completenessSatisfied=false` and fail-closed.

2. **Local/global contradiction not auto-detected**
- Risk: local mismatch present but global tier remains too soft due reducer drift.
- Mitigation: add explicit `globalVerdictConsistency` invariant; inconsistency emits hard-invalid trigger.
- Deterministic test: contradiction fixture yields `hard-invalid:global-local-inconsistency` and invalid tier.

3. **Causal-chain prose without auditable bindings**
- Risk: chain can be persuasive text detached from concrete inputs/rules.
- Mitigation: each step requires `(sourceRef, ruleRef, outputRef)` and final-link hash parity with top claim-limiting reason.
- Deterministic test: missing refs/hash linkage fails chain validation and fail-closes verdict.

4. **Rule-table drift undermines comparability**
- Risk: same fields, changed semantics, silent cross-run drift.
- Mitigation: include `authenticityRuleTableHash` + `ruleVersion` and enforce classifier-renderer hash parity.
- Deterministic test: hash mismatch triggers hard-invalid consistency error.

## Minimal next build slice
1. Evidence-diversity gate in `authenticityModelQuality`.
2. Global/local consistency hard-invalid invariant.
3. Causal-chain reference+hash binding validation.

## Caveat
- This is a design-level red-team artifact (no on-chain spend, no live battle claim).
