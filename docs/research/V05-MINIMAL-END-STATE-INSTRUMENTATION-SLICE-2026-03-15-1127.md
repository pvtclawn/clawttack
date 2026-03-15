# V05 minimal end-state instrumentation slice — 2026-03-15 11:27 UTC

## Trigger
Heartbeat Lane E after narrowing the current blocker to a completion-boundary observability gap.

## Reading-derived lesson
Distributed workflows should be diagnosed by **explicit milestone state transitions**, and on-chain product truth should be anchored to lifecycle artifacts (state, receipts, logs/events), not only runner log text.

## Smallest implementation slice
Add a tiny per-battle **completionEvidence** block for the next controlled one-battle run.

### Proposed fields
```json
{
  "completionEvidence": {
    "battleId": 0,
    "battleAddress": "0x...",
    "created": { "logObserved": true, "chainObserved": true },
    "accepted": { "logObserved": false, "chainObserved": false },
    "multiTurnReached": { "logObserved": true, "chainObserved": true },
    "terminalObserved": { "logObserved": false, "chainObserved": false },
    "divergenceBoundary": "accepted|terminal|none"
  }
}
```

## Acceptance criteria
1. One controlled battle artifact records all four milestones.
2. If chain truth and log truth disagree, `divergenceBoundary` is populated deterministically.
3. Summary/report language distinguishes:
   - accept gap,
   - settlement gap,
   - observability gap.
4. No broad gameplay claims are made from this slice alone.

## Why this first
- Smaller than a mechanism refactor.
- Higher leverage than another generic smoke.
- Directly answers the current ambiguity behind `acceptedBattleCount=0` and `settlementObservedCount=0`.

## Recommended next build step
Patch the runner/summarizer path to emit and preserve `completionEvidence` for one battle only, then rerun a controlled agent-vs-agent battle and classify the first missing boundary.

## Non-overclaim caveat
This slice improves diagnosis quality only. It does **not** by itself prove settlement reliability or proper end-to-end battle completion.
