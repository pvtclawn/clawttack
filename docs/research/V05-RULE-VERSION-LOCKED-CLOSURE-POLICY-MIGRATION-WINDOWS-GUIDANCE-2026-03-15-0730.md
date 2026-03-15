# V05 rule-version-locked closure policy migration windows — guidance (2026-03-15 07:30 UTC)

## Research question
Should closure key-classification policy be rule-version-locked with explicit migration windows to avoid noisy upgrade transitions while preserving fail-closed behavior?

## Signal summary
External signal was mixed/noisy, but consistent contract-governance pattern remains clear:
- compatibility must be **explicitly versioned**,
- migration windows should be bounded and auditable,
- runtime enforcement should reject ambiguous policy drift rather than infer intent.

## Decision
**Yes — lock closure key-classification policy to rule version with explicit migration windows.**

Without version-lock + migration contract, valid policy upgrades can look like attacks (noise), and attacks can masquerade as “in-flight migration” (risk).

## Deterministic migration model

### 1) Version-locked policy identity
- Add mapping: `ruleVersion -> closureKeyClassificationPolicyHash`.
- Runtime accepts only the exact mapped hash for the active rule version unless migration window explicitly active.

### 2) Explicit migration window contract
Add metadata fields:
- `policyMigrationFromVersion`
- `policyMigrationToVersion`
- `policyMigrationWindowId`
- `policyMigrationWindowOpen` (bool)
- `policyMigrationWindowExpiresAt` (deterministic timestamp/epoch reference)

### 3) Acceptance logic
- If migration window closed: only `toVersion` hash accepted.
- If migration window open: accept `fromVersion` or `toVersion` hashes **only**.
- Any other hash/version pair fail-closes.

### 4) Fail-closed trigger extensions
- Keep existing downgrade trigger for explicit hash mismatch.
- Add migration-specific trigger:
  - `hard-invalid:closure-policy-migration-window-invalid`
  (window closed/expired/malformed or version pair unauthorized).

## Why this helps
1. Reduces false alarms during legitimate upgrades.
2. Prevents attackers from hiding downgrades behind vague “migration” claims.
3. Maintains deterministic non-credit behavior when migration metadata is inconsistent.

## Suggested acceptance criteria (next build/verify)
- Fixture A: window closed, correct current hash => pass (no migration trigger).
- Fixture B: window open, from/to hash pair valid => pass (no migration trigger).
- Fixture C: window open but unauthorized hash/version => `hard-invalid:closure-policy-migration-window-invalid`.
- Fixture D: window expired but old hash presented => invalid trigger + non-credit tier.
- Markdown/json both surface migration-window state and selected hash path.

## Posting decision
No external post (internal governance-hardening guidance only).
