# V05 Challenge — timeout-cap safety-envelope fingerprint spoofing (2026-03-15 06:40 UTC)

## Scope
Red-team spoof/replay/drift risks for `timeoutCapSafetyEnvelope` invariants and determinism fingerprints.

## Findings (4 weaknesses)
1. **Fingerprint replay across rule-version drift**
   - Mitigation: bind fingerprint to `ruleVersion + ruleHash + modeProfileHash + evidenceTupleHash`.
   - Trigger: `hard-invalid:safety-envelope-fingerprint-version-mismatch`.

2. **Selective evidence omission before hashing**
   - Mitigation: evidence-closure manifest hash required in fingerprint input.
   - Trigger: `hard-invalid:safety-envelope-evidence-closure-incomplete`.

3. **Non-canonical equivalent-tuple encoding drift**
   - Mitigation: strict canonical serialization contract before hashing.
   - Trigger: `hard-invalid:safety-envelope-canonicalization-drift`.

4. **Mode-profile hot-swap without lineage proof**
   - Mitigation: signed profile lineage/revision binding in envelope preimage.
   - Trigger: `hard-invalid:safety-envelope-profile-lineage-mismatch`.

## Minimal next implementation slice
1. Rule-version/hash preimage binding.
2. Evidence-closure manifest hashing.
3. Canonicalization drift detector.

## Caveat
Design-level challenge artifact only; no live on-chain claim.
