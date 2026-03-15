# V05 schema-evolution stable evidence-closure manifest hashing — guidance (2026-03-15 07:05 UTC)

## Question
How do we keep evidence-closure manifest hashing deterministic across evolving schemas without brittle false positives?

## Reading-derived conclusion
Split closure hashing into **core-required** vs **full-present** views. Deterministic safety should anchor to required-core evidence by default, while full-set drift remains observable for strict replay/audit modes.

## Recommended extension
Add closure-manifest schema controls:
- `closureSchemaVersion`
- `closureCompatibilityMode` (`strict-core` | `strict-all`)
- `requiredCoreEvidenceKeys`
- `optionalEvidenceKeysPresent`
- `coreClosureManifestHash`
- `fullClosureManifestHash`

## Deterministic policy
1. Default `strict-core` for forward-compatible operation:
   - optional additive fields do not cause hard-invalid.
2. Use `strict-all` for exact replay/audit contexts:
   - any field-set drift is treated as mismatch.
3. Missing required-core key always fail-closes via:
   - `hard-invalid:safety-envelope-evidence-closure-incomplete`.

## One-battle acceptance criteria (next verify slice)
- Fixture A: add optional key -> core hash stable, no hard-invalid in `strict-core`.
- Fixture B: same additive key -> full hash changes and is flagged in `strict-all` mode.
- Fixture C: remove required-core key -> closure-incomplete hard-invalid.

## Caveat
Guidance artifact only; no live on-chain claim.
