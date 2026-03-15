# V05 Hard Invalid Trigger Render Verification — 2026-03-15 01:20 UTC

## Scope
Verify that the newly encoded hard invalid triggers are not only present in internal per-battle data, but also render clearly in generated per-battle artifacts before bounded summary templates are added.

Target fields:
- `invalidForProperBattle`
- `forcedVerdictTier`
- `hardInvalidTriggers`
- rendered markdown classification block containing those fields

## Trigger
Heartbeat Lane C after:
- `4e52d56` — `feat(v05): encode hard invalid battle triggers`

## Verification method
Used a deterministic synthetic harness that:
1. imports `packages/sdk/scripts/summarize-v05-batches.py`,
2. creates temporary log/checkpoint/metadata fixtures,
3. calls `build_per_battle(...)`,
4. writes JSON + markdown per-battle artifacts,
5. extracts the rendered `## classification contract` section for inspection.

This avoids polluting real `battle-results/` and keeps the verification deterministic.

## Synthetic invalid case shape
- execution outcome: `clean-exit`
- gameplay outcome becomes `non-terminal`
- source-of-move for side A is intentionally `unknown`
- transcript shape also triggers severe transcript-quality failure:
  - repeated template-like narrative,
  - fallback phrase presence,
  - template marker presence

## Observed structured output
```json
{
  "invalidForProperBattle": true,
  "forcedVerdictTier": "invalid-for-proper-battle",
  "hardInvalidTriggers": [
    "hard-invalid:source-of-move-unknown:A",
    "hard-invalid:severe-transcript-quality-failure"
  ],
  "properBattleReasons": [
    "gameplay-outcome:non-terminal",
    "source-of-move-unknown:A"
  ]
}
```

## Observed rendered markdown excerpt
```md
## classification contract
- execution outcome: `clean-exit`
- gameplay outcome: `non-terminal`
- source of move A: `unknown` (strategy `None` agent `None`)
- source of move B: `gateway-agent` (strategy `gateway` agent `fighter`)
- counts as proper battle: `False`
- proper battle reasons: gameplay-outcome:non-terminal, source-of-move-unknown:A
- invalid for proper battle: `True`
- forced verdict tier: `invalid-for-proper-battle`
- hard invalid triggers: hard-invalid:source-of-move-unknown:A, hard-invalid:severe-transcript-quality-failure
```

## Verified conclusions
1. Hard invalid trigger state surfaces in per-battle JSON artifacts.
2. Forced invalid verdict tier surfaces in per-battle JSON artifacts.
3. The markdown classification block now renders invalid status and hard invalid triggers clearly.
4. Fail-closed invalidation is now artifact-legible rather than hidden in code.

## On-chain classification
- **Verified no action needed.**
- No tx/gas spend was justified for this lane because the target claim was about deterministic artifact rendering, not live battle mechanics.

## Narrow caveat
- This verifies render integrity for the hard invalid layer.
- It does **not** yet add bounded lower-tier summary templates or the full visible tier-to-reason mapping beyond the invalid layer.
