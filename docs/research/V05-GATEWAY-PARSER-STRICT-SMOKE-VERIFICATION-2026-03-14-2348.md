# V05 Gateway Parser Strict Smoke Verification — 2026-03-14 23:48 UTC

## Scope
Verify that the repaired `v05-battle-loop.ts` now uses the hardened gateway JSON parser path successfully in a real live run, specifically when OpenClaw emits plugin/preamble noise before the expected JSON payload.

## Trigger
Heartbeat Lane C after Lane B restored the missing `extractJsonObject` import and removed duplicated trailing code from `packages/sdk/scripts/v05-battle-loop.ts`.

## Command run
```bash
CLAWTTACK_BATCH_BATTLES=1 CLAWTTACK_MAX_TURNS=120 python3 packages/sdk/scripts/batch-battles.py
```

## Build-health gate
- `git -C projects/clawttack status --short` reviewed before execution.
- Working tree was clean enough for verification lane work; no new code edits were required during this lane.

## Live artifact captured
- Battle log:
  - `projects/clawttack/battle-results/batch-58-1773532122.log`
- Checkpoint:
  - `projects/clawttack/battle-results/checkpoints/batch-58-1773532122.json`
- Battle address:
  - `0xA7b7F8C81117D8e7876381B629D6f94D037C5d7e`

## Verified parser-boundary behavior
The live runner encountered exactly the noisy gateway shape that previously caused failure:

```text
[plugins] openclaw-mem0: registered ...
{ "runId": ..., "status": "ok", "summary": "completed", "result": ... }
```

Observed parser stages in the live battle log:
1. `gateway-envelope mode=direct status=fail reason=JSON Parse error: Unexpected identifier "plugins"`
2. `gateway-envelope mode=balanced status=ok index=0`
3. `gateway-payload mode=direct status=ok`

This proves the hardened extraction path is active and is successfully tolerating plugin/noise preamble instead of dying on raw `JSON.parse(...)`.

## On-chain turn evidence captured so far
From checkpoint `batch-58-1773532122.json` at capture time:

- turn 0 (A)
  - tx: `0xbf880627129b7f2dacd9ec6e87c489dfebe63cf2862dea1ba635e70c6dfe0b0d`
  - block: `38881945`
- turn 1 (B)
  - tx: `0x90671375c4f2dab8597f1b5dde5255bcc548fefb2e51ec5a6866a5c9cd20de98`
  - block: `38881956`
- turn 2 (A)
  - tx: `0x81dc5c82745df38ff8faa42a3e51de88a91af46cbf58031a9208cd8451e89752`
  - block: `38881966`
- turn 3 (B)
  - tx: `0xa7c045b8d5ddbd61d0a2aa2c1cfec7ff9f63bfaf0f2fb9fbd3c901eca2bc3822`
  - block: `38881982`
- turn 4 (A)
  - tx: `0x30b9237c292f308d4f988586362a39589b15439defdd0fe828dd36e4e7ec8996`
  - block: `38881994`
- turn 5 (B)
  - tx: `0x8874e25043a66534bb9f742157aef0e7e6e94d913cc1fa1fdb781d76f62cccb5`
  - block: `38882008`

## Verified conclusions
1. The repaired import is active in the live runner codepath.
2. Gateway preamble/noise is present in real output and no longer causes fatal parse failure.
3. The runner advances beyond parser boundary and submits real on-chain turns.
4. The earlier parser-contamination blocker is cleared for this tested path.

## Narrow caveat
- This artifact is intentionally scoped to the captured strict smoke path.
- At capture time the batch process was still running, so this document proves parser-boundary recovery plus multiple mined turns, not yet full-battle completion/settlement for this specific run.
- This does **not** yet prove all gateway output variants are safe forever; it proves the previously failing noisy-prefix shape is now handled live.

## On-chain classification
- Produced a real verification artifact with mined gameplay turns.
- No additional tx beyond the smoke run itself were needed for this lane.
