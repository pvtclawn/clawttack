# V05 Claim-Limiting Reason Priority Render Verification — 2026-03-15 01:50 UTC

## Scope
Verify that the newly encoded deterministic reason-priority layer does not just sort reasons internally, but also renders the selected top claim-limiting reason clearly in per-battle artifacts.

Target fields:
- `topProperBattleReason`
- `topHardInvalidTrigger`
- `topClaimLimitingReason`
- `topClaimLimitingReasonSource`
- rendered markdown classification block containing those fields

## Trigger
Heartbeat Lane C after:
- `670cf5f` — `feat(v05): prioritize claim-limiting verdict reasons`

## Verification method
Used a deterministic synthetic harness that:
1. imports `packages/sdk/scripts/summarize-v05-batches.py`,
2. creates temporary log/checkpoint/metadata fixtures,
3. calls `build_per_battle(...)`,
4. writes JSON + markdown per-battle artifacts,
5. extracts the rendered `## classification contract` section for inspection.

This avoids polluting real `battle-results/` and keeps the verification deterministic.

## Synthetic competing-reasons case
Constructed a run with multiple simultaneous claim-limiting signals:
- execution outcome = `supervisor-interrupted`
- gameplay outcome = `mid-battle-interrupted`
- source-of-move ambiguity for side A = `unknown`

This is a good test because it forces the selector to choose among multiple negative reasons rather than simply echoing the only one available.

## Observed structured output
```json
{
  "properBattleReasons": [
    "source-of-move-unknown:A",
    "execution-outcome:supervisor-interrupted",
    "gameplay-outcome:mid-battle-interrupted"
  ],
  "topProperBattleReason": "source-of-move-unknown:A",
  "hardInvalidTriggers": [
    "hard-invalid:source-of-move-unknown:A"
  ],
  "topHardInvalidTrigger": "hard-invalid:source-of-move-unknown:A",
  "topClaimLimitingReason": "hard-invalid:source-of-move-unknown:A",
  "topClaimLimitingReasonSource": "hard-invalid-trigger"
}
```

## Observed rendered markdown excerpt
```md
## classification contract
- execution outcome: `supervisor-interrupted`
- gameplay outcome: `mid-battle-interrupted`
- source of move A: `unknown` (strategy `None` agent `None`)
- source of move B: `gateway-agent` (strategy `gateway` agent `fighter`)
- counts as proper battle: `False`
- proper battle reasons: source-of-move-unknown:A, execution-outcome:supervisor-interrupted, gameplay-outcome:mid-battle-interrupted
- top proper battle reason: `source-of-move-unknown:A`
- invalid for proper battle: `True`
- forced verdict tier: `invalid-for-proper-battle`
- hard invalid triggers: hard-invalid:source-of-move-unknown:A
- top hard invalid trigger: `hard-invalid:source-of-move-unknown:A`
- top claim-limiting reason: `hard-invalid:source-of-move-unknown:A` (hard-invalid-trigger)
```

## Verified conclusions
1. Deterministic reason ordering is reflected in per-battle JSON artifacts.
2. The harsher source-of-move ambiguity reason correctly outranks softer interruption/gameplay caveats in this tested case.
3. The rendered markdown classification block now exposes the selected top reason/trigger explicitly.
4. The next template patch can rely on an artifact-visible top claim-limiting reason instead of choosing reasons opportunistically.

## On-chain classification
- **Verified no action needed.**
- No tx/gas spend was justified for this lane because the target claim was about deterministic reason selection/rendering, not live battle mechanics.

## Narrow caveat
- This verifies reason-priority render integrity.
- It does **not** yet implement the anti-spin summary-block rules or readable+raw reason pairing.
