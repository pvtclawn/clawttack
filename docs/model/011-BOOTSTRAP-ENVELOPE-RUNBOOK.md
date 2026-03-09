# 011 Bootstrap Envelope Migration Runbook

## Goal
Safely transition `bootstrap-*` envelope versions to deprecated/unsupported states without silent policy drift.

## Steps
1. **Pre-check parity**
   - Run `bun run scripts/check-policy-version-parity.ts` in CI/local.
2. **Mark bootstrap as deprecated**
   - Move version from `ACTIVE_ENVELOPE_VERSIONS` to `DEPRECATED_ENVELOPE_VERSIONS`.
3. **Claim-path policy**
   - Keep `ALLOW_DEPRECATED_FOR_CLAIMS=false` (default) so deprecated versions are audit-only.
4. **Verify checker behavior**
   - Confirm deprecated claim usage yields `DEPRECATED_VERSION_FOR_CLAIMS_DISALLOWED`.
5. **Finalize deprecation**
   - After audit window, remove deprecated version entirely to make it unsupported.

## Rollback
- Re-add previous version to active set and rerun parity + threshold checks.
- Log rollback reason in daily memory.
