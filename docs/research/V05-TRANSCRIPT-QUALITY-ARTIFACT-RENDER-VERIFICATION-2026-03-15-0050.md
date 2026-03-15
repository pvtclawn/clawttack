# V05 Transcript-Quality Artifact Render Verification — 2026-03-15 00:50 UTC

## Scope
Verify that the newly added transcript-quality signals are not only present in internal per-battle data, but also render correctly in generated per-battle artifacts before any rubric-counted live run.

Target fields:
- `transcriptQuality`
- `transcriptQualityFailureReasons`
- rendered markdown `## transcript-quality checks` section

## Trigger
Heartbeat Lane C after:
- `10f14f0` — `feat(v05): add observable transcript quality signals`

## Verification method
Used a deterministic synthetic harness that:
1. imports `packages/sdk/scripts/summarize-v05-batches.py`,
2. creates temporary log/checkpoint/metadata fixtures,
3. calls `build_per_battle(...)`,
4. writes both JSON and markdown per-battle artifacts via `write_json(...)` and `write_markdown(...)`,
5. extracts the rendered markdown transcript-quality section for inspection.

This keeps verification deterministic and avoids polluting real `battle-results/` with test artifacts.

## Synthetic case shape
- mode-like context: gateway agent vs local script
- execution outcome: `clean-exit`
- two mined turns in checkpoint
- one narrative sample deliberately contains template-like fallback phrases:
  - `relay holds firm`
  - `Sequence remains coherent.`
- log includes `template=relay`

## Observed JSON-level transcript-quality output
```json
{
  "narrativeSampleCount": 2,
  "constraintSignalsVisible": true,
  "repetitionRisk": "elevated",
  "sceneCoherenceHint": true,
  "fallbackMasqueradeRisk": true,
  "failureReasons": [
    "repetition-risk-elevated",
    "fallback-masquerade-risk"
  ],
  "signals": {
    "fallbackPhraseDetected": true,
    "templateMarkerDetected": true,
    "repeatedSampleDetected": false,
    "lowUniqueRatioDetected": true,
    "logHasTemplateMarkers": true
  }
}
```

## Observed rendered markdown excerpt
```md
## transcript-quality checks
- narrative sample count: `2`
- constraint signals visible: `True`
- scene coherence hint: `True`
- repetition risk: `elevated`
- fallback masquerade risk: `True`
- transcript-quality failure reasons: repetition-risk-elevated, fallback-masquerade-risk
```

## Verified conclusions
1. The new transcript-quality signals surface in per-battle JSON artifacts.
2. The new transcript-quality failure reasons surface in per-battle JSON artifacts.
3. The markdown artifact now renders a dedicated `## transcript-quality checks` section.
4. Template-like / fallback-like transcript risk is exposed as explicit reasons rather than soft prose judgment.

## On-chain classification
- **Verified no action needed.**
- No tx/gas spend was justified for this lane because the target claim was about deterministic artifact rendering, not live battle mechanics.

## Narrow caveat
- This verifies render integrity for the new transcript-quality fields.
- It does **not** yet implement verdict tiers or make these signals decisive in the final proper-battle verdict.
