# V05 Governed Verdict Block Render Verification — 2026-03-15 02:20 UTC

## Scope
Verify that the newly encoded governed verdict block is not only present in internal per-battle data, but also renders as a discrete boundary in generated per-battle artifacts.

Target fields:
- `governedVerdictBlock`
- rendered markdown `## governed verdict block` section

## Trigger
Heartbeat Lane C after:
- `34134e5` — `feat(v05): encode governed verdict block scope`

## Verification method
Used a deterministic synthetic harness that:
1. imports `packages/sdk/scripts/summarize-v05-batches.py`,
2. creates temporary log/checkpoint/metadata fixtures,
3. calls `build_per_battle(...)`,
4. writes JSON + markdown per-battle artifacts,
5. extracts the rendered `## governed verdict block` section for inspection.

This avoids polluting real `battle-results/` and keeps the verification deterministic.

## Synthetic case shape
- execution outcome = `supervisor-interrupted`
- gameplay outcome = `mid-battle-interrupted`
- source-of-move:
  - A = `gateway-agent`
  - B = `local-script`
- no hard-invalid trigger, so the governed block renders a non-credit but non-invalid state.

## Observed structured output
```json
{
  "scopeVersion": "v1",
  "sectionKey": "governed-verdict-block",
  "fieldOrder": [
    "displayedTier",
    "creditStatus",
    "adjacentReason"
  ],
  "displayedTier": "non-credit-unclassified",
  "creditStatus": "non-credit",
  "adjacentReason": "execution-outcome:supervisor-interrupted",
  "adjacentReasonSource": "proper-battle-reason",
  "followUpInterpretationInsideBlockAllowed": false,
  "postBlockInterpretationAllowed": true
}
```

## Observed rendered markdown excerpt
```md
## governed verdict block
- scope version: `v1`
- section key: `governed-verdict-block`
- field order: displayedTier, creditStatus, adjacentReason
- displayed tier: `non-credit-unclassified`
- credit status: `non-credit`
- adjacent reason: `execution-outcome:supervisor-interrupted` (proper-battle-reason)
- follow-up interpretation inside block allowed: `False`
- post-block interpretation allowed: `True`
```

## Verified conclusions
1. `governedVerdictBlock` surfaces as a first-class per-battle artifact object.
2. The governed verdict block renders as its own markdown section rather than being buried inside the broader classification dump.
3. The block boundary is now implementation-visible with fixed fields and explicit interpretation allowances.
4. Future anti-spin work can target a discrete governed region instead of relying on documentation-only concepts.

## On-chain classification
- **Verified no action needed.**
- No tx/gas spend was justified for this lane because the target claim was about deterministic artifact rendering, not live battle mechanics.

## Narrow caveat
- This verifies governed verdict block render integrity.
- It does **not** yet cool lower-tier displayed labels or add readable+raw reason pairing.
