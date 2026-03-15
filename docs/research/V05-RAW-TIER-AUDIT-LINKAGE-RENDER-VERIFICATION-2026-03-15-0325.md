# V05 Raw-Tier Audit Linkage Render Verification — 2026-03-15 03:25 UTC

## Scope
Verify that the newly added raw-tier audit linkage renders clearly in the governed verdict block while keeping the cooled `displayedTier` primary.

Target fields:
- `governedVerdictBlock.displayedTier`
- `governedVerdictBlock.rawTier`
- `governedVerdictBlock.rawTierRole`
- `governedVerdictBlock.primaryLabelField`
- rendered markdown `## governed verdict block` section

## Trigger
Heartbeat Lane C after:
- `18f016b` — `feat(v05): add audit-only raw tier linkage`

## Verification method
Used a deterministic synthetic harness that:
1. imports `packages/sdk/scripts/summarize-v05-batches.py`,
2. creates temporary log/checkpoint/metadata fixtures,
3. calls `build_per_battle(...)`,
4. writes markdown per-battle artifacts,
5. extracts the rendered `## governed verdict block` section for inspection.

This avoids polluting real `battle-results/` and keeps the verification deterministic.

## Cases tested
### 1. Non-credit exploratory case
Expected governed block behavior:
- primary label field = `displayedTier`
- display label = `non-credit / exploratory`
- raw tier = `non-credit-unclassified`
- raw tier role = `audit-only`

### 2. Non-credit invalid case
Expected governed block behavior:
- primary label field = `displayedTier`
- display label = `non-credit / invalid`
- raw tier = `invalid-for-proper-battle`
- raw tier role = `audit-only`

## Observed structured output
```json
{
  "exploratory": {
    "primaryLabelField": "displayedTier",
    "displayedTier": "non-credit / exploratory",
    "rawTier": "non-credit-unclassified",
    "rawTierRole": "audit-only",
    "creditStatus": "non-credit"
  },
  "invalid": {
    "primaryLabelField": "displayedTier",
    "displayedTier": "non-credit / invalid",
    "rawTier": "invalid-for-proper-battle",
    "rawTierRole": "audit-only",
    "creditStatus": "non-credit"
  }
}
```

## Observed rendered markdown excerpts
### Exploratory
```md
## governed verdict block
- scope version: `v1`
- section key: `governed-verdict-block`
- field order: displayedTier, rawTier, creditStatus, adjacentReason
- primary label field: `displayedTier`
- displayed tier: `non-credit / exploratory`
- raw tier: `non-credit-unclassified` (audit-only)
- credit status: `non-credit`
- adjacent reason: `execution-outcome:supervisor-interrupted` (proper-battle-reason)
- follow-up interpretation inside block allowed: `False`
- post-block interpretation allowed: `True`
```

### Invalid
```md
## governed verdict block
- scope version: `v1`
- section key: `governed-verdict-block`
- field order: displayedTier, rawTier, creditStatus, adjacentReason
- primary label field: `displayedTier`
- displayed tier: `non-credit / invalid`
- raw tier: `invalid-for-proper-battle` (audit-only)
- credit status: `non-credit`
- adjacent reason: `hard-invalid:severe-transcript-quality-failure` (hard-invalid-trigger)
- follow-up interpretation inside block allowed: `False`
- post-block interpretation allowed: `True`
```

## Verified conclusions
1. The governed verdict block now exposes raw/internal tier state locally for audit.
2. `displayedTier` remains the explicitly primary label.
3. `rawTier` is visible but clearly marked `audit-only`.
4. The cooled display surface stays downgraded while the audit mapping remains visible and unambiguous.

## On-chain classification
- **Verified no action needed.**
- No tx/gas spend was justified for this lane because the target claim was about deterministic artifact rendering, not live battle mechanics.

## Narrow caveat
- This verifies raw-tier audit-linkage render integrity for current JSON/markdown artifact surfaces.
- It does **not** yet perform the broader cross-surface consistency check beyond these current artifact outputs.
