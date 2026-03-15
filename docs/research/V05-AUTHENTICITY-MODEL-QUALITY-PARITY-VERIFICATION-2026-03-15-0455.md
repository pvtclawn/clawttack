# V05 authenticityModelQuality parity verification — 2026-03-15 04:55 UTC

## Goal
Verify that newly added `authenticityModelQuality` fields are:
1. deterministic across single-source fail vs multi-source pass fixtures,
2. visible in markdown output,
3. compatible with existing governed verdict block markdown/json parity checks.

## Method
- Loaded `packages/sdk/scripts/summarize-v05-batches.py` in an isolated temp harness.
- Ran two synthetic cases with identical battle payloads except evidence-source list:
  - **single-source**: `['metadata.sourceOfMove']`
  - **multi-source**: `['metadata.sourceOfMove', 'checkpoint.results']`
- For each case:
  1. built per-battle artifact via `build_per_battle(...)`,
  2. rendered markdown via `write_markdown(...)`,
  3. evaluated governed-block parity via `evaluate_governed_block_surface_parity(...)`,
  4. asserted markdown contains model-quality + evidence-source lines.

## Captured results
```json
{
  "singleSource": {
    "evidenceSourceCount": 1,
    "independentSourcePresent": false,
    "completenessSatisfied": false,
    "failsClosed": true,
    "parityStatus": "aligned",
    "markdownHasModelQualityLine": true,
    "markdownHasEvidenceSourcesLine": true
  },
  "multiSource": {
    "evidenceSourceCount": 2,
    "independentSourcePresent": true,
    "completenessSatisfied": true,
    "failsClosed": false,
    "parityStatus": "aligned",
    "markdownHasModelQualityLine": true,
    "markdownHasEvidenceSourcesLine": true
  }
}
```

## Verification conclusion
- Diversity gate behavior is deterministic:
  - single-source fixture fail-closes,
  - multi-source fixture passes completeness.
- Markdown now reliably exposes both model-quality and evidence-source fields.
- Governed verdict block parity remains aligned after introducing these new fields.

## Caveat
- This is artifact-layer synthetic verification only; no new live on-chain battle claim is made.
