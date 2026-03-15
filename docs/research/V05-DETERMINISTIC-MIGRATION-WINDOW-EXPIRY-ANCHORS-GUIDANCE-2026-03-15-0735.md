# V05 deterministic migration-window expiry anchors — guidance (2026-03-15 07:35 UTC)

## Question
How do we make closure-policy migration-window expiry deterministic under distributed clock uncertainty?

## Reading-derived conclusion
Use durable-execution style **anchor-based expiry** (event/epoch driven) instead of wall-clock-only expiry. Deterministic replay should produce the same window verdict for the same artifact.

## Recommended extension
Add migration expiry anchor fields:
- `policyMigrationExpiryAnchorType` (`epoch-height` | `event-seq` | `wall-clock`)
- `policyMigrationExpiryAnchorValue`
- `policyMigrationEvaluationAnchorValue`
- `policyMigrationWindowExpiredDeterministic`
- `policyMigrationEvaluationMode` (`strict-anchor` | `legacy-clock`)

## Deterministic policy
1. Default `strict-anchor` mode for new rule versions.
2. Window-expired decision = `evaluationAnchor >= expiryAnchor`.
3. Missing anchor data in strict mode => fail-closed with migration-window-invalid trigger.
4. `legacy-clock` mode allowed only as explicit backward-compatibility path, with reduced-confidence labeling.

## One-battle acceptance criteria (next verify slice)
- Fixture A: identical anchor replay -> identical expired/non-expired decision.
- Fixture B: strict-anchor + missing anchor fields -> `hard-invalid:closure-policy-migration-window-invalid`.
- Fixture C: legacy-clock flag present -> accepted only with explicit compatibility caveat rendered in markdown/json.

## Caveat
Guidance artifact only; no live on-chain claim.
