# V05 provenance-mismatch parity verification — 2026-03-15 04:25 UTC

## Goal
Verify that the new `hard-invalid:provenance-mismatch:*` trigger is:
1. emitted deterministically in per-battle JSON classification,
2. selected as top claim-limiting reason when present,
3. preserved with governed-block markdown/json surface parity.

## Method (synthetic fixture)
- Created temporary synthetic per-battle inputs with:
  - metadata source mismatch on side A:
    - `strategy: gateway`
    - `kind: local-script`
  - side B consistent (`docker-agent` / `docker-agent`)
  - clean-exit + terminal-like transcript context to isolate provenance behavior.
- Built artifact through `build_per_battle(...)` then rendered markdown via `write_markdown(...)`.
- Ran `evaluate_governed_block_surface_parity(...)` on rendered markdown.

## Command
```bash
python3 - <<'PY'
# (inline harness) import summarize-v05-batches.py, build synthetic per-battle,
# render markdown, compute parity status, print key fields as json
PY
```

## Result (captured JSON)
```json
{
  "hardInvalidTriggers": [
    "hard-invalid:provenance-mismatch:A:expected-gateway-agent:got-local-script"
  ],
  "topHardInvalidTrigger": "hard-invalid:provenance-mismatch:A:expected-gateway-agent:got-local-script",
  "topClaimLimitingReason": "hard-invalid:provenance-mismatch:A:expected-gateway-agent:got-local-script",
  "invalidForProperBattle": true,
  "forcedVerdictTier": "invalid-for-proper-battle",
  "parityStatus": "aligned",
  "parityChecks": {
    "sectionPresent": true,
    "fieldOrderAligned": true,
    "primaryLabelAligned": true,
    "displayedTierRendered": true,
    "rawTierRendered": true,
    "displayedTierBeforeRawTier": true,
    "rawTierMarkedAuditOnly": true
  }
}
```

## Verification conclusion
- Provenance mismatch trigger is active and deterministic for the tested mismatch case.
- Trigger dominates claim-limiting reason selection as intended.
- Governed-block markdown/json parity remains aligned after the new trigger class.

## Caveat
- This verifies artifact-layer classification/rendering behavior only (synthetic fixture), not live on-chain battle execution paths.
