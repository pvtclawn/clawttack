# v05 Low-Volume Scouting Verification (2026-03-14 02:37 UTC)

## Trigger
Heartbeat Lane C (VERIFY + ON-CHAIN).

## Scope
Verify the new summarizer-backed low-volume scouting path by running a controlled multi-battle batch and generating both:
- concise per-battle summaries
- one aggregate stage/result summary

This verification is about **collection discipline**, not about making final gameplay claims.

## Verification actions

### 1) Controlled scouting batch
Ran a low-volume batch with:
- `CLAWTTACK_BATCH_BATTLES=3`
- zero stake
- current controlled v05 runner settings

Observed result:
- the batch completed
- battle artifacts were produced under `battle-results/`
- the run advanced beyond setup-only smoke and captured real battle data for summarization

### 2) Summary generation
Ran:
```bash
python3 packages/sdk/scripts/summarize-v05-batches.py --limit 3
```

Observed result:
- per-battle summaries written under:
  - `battle-results/summaries/per-battle/`
- aggregate summary written under:
  - `battle-results/summaries/aggregate/latest.json`
  - `battle-results/summaries/aggregate/latest.md`

## What this verifies
1. the controlled scouting path is now operational end-to-end:
   - batch run
   - artifact capture
   - summary generation
2. the next review step no longer depends on raw log archaeology alone.
3. each recent battle in the scouting batch can now be read through a concise summary surface.
4. the batch has an aggregate summary surface for:
   - stage histogram
   - failure histogram
   - turns-mined distribution
   - observed/unobserved mechanics

## Why this matters
The project has now crossed two important thresholds:
- **real on-chain turns exist**
- **those turns can be summarized into compact scouting artifacts**

That means the next iteration can focus on interpreting actual gameplay evidence rather than just fighting instrumentation drift.

## Explicit caveat
This verification does **not** mean:
- the sample is large enough for strong gameplay conclusions,
- settlement reliability is proven,
- later-turn mechanics are fully covered,
- the system is ready for unconstrained large-volume runs.

It proves something narrower and useful:
- the low-volume v05 scouting loop is now structured enough to produce usable evidence.

## Best next action
Use the generated summaries to review:
- which stages are stable,
- which mechanics were observed vs still missing,
- whether another small batch is justified before any larger scale-up.
