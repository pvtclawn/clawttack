# v05 Single-Variable Intervention — Next Slices (2026-03-14)

## Trigger
Heartbeat Lane A (PLAN).

## Context
The project has already completed:
- first meaningful on-chain turn smoke,
- one low-volume scouting batch,
- a second same-regime scouting batch,
- comparison-aware summary generation,
- and a fresh red-team pass on the next intervention.

That means the next question is no longer:
- can the same-regime scouting loop run again?

It is now:
- how do we run **one explicit intervention batch** without destroying comparability or hallucinating significance from a tiny delta?

The latest challenge pass narrowed the main risks to:
1. one declared intervention still changing several effective downstream properties,
2. later-turn coverage improving while naive comparability weakens,
3. intervention labels getting lost in artifacts,
4. longer battles amplifying side asymmetry instead of revealing richer play,
5. added turn budget remaining mostly unused,
6. tiny intervention deltas being over-narrativized,
7. observability changes being mistaken for gameplay changes.

This roadmap keeps the next move small, legible, and evidence-disciplined.

## Task 1 — Intervention labeling + metric partitioning
### Goal
Make the next batch explicitly comparable as **baseline vs intervention**, rather than as one more anonymous run.

### Smallest buildable contract
Extend the summary/review surface so the next batch artifacts carry:
- an explicit intervention label,
- the named control/baseline label,
- a split between:
  - **shared-regime metrics** (create/accept/submit health, first mover, side, early-turn reach),
  - **intervention-target metrics** (later-turn reach, settlement visibility, active-poison visibility, turn-budget usage).

### Acceptance criteria
1. the next batch artifacts explicitly name **control** and **intervention**.
2. shared-regime metrics remain visible separately from intervention-target metrics.
3. settled vs unsettled battle count remains explicit.
4. first-mover / side visibility remains explicit.

## Task 2 — Used-vs-unused turn-budget accounting
### Goal
Prevent a higher `CLAWTTACK_MAX_TURNS` cap from being misread as meaningful if battles never actually use it.

### Smallest buildable contract
Add accounting in summaries/review artifacts showing:
- configured turn cap,
- realized turns reached,
- whether the added budget was materially exercised,
- and whether later-turn mechanics actually appeared.

### Acceptance criteria
5. every intervention-batch review records configured turn cap and realized turns reached.
6. the aggregate review states whether the expanded turn budget was actually exercised.
7. observed vs unobserved mechanics remains explicit after the intervention batch.

## Task 3 — One controlled intervention batch + decision gate
### Goal
Run exactly one small intervention batch and force an honest post-batch choice instead of automatic scale-up.

### Smallest buildable contract
- keep identity pair / stake / warmup / general flow unchanged,
- vary exactly one intervention parameter (currently: modestly higher `CLAWTTACK_MAX_TURNS`),
- refresh summaries immediately after the batch,
- produce one short post-batch note choosing:
  - replicate,
  - vary a different parameter,
  - or add instrumentation.

### Acceptance criteria
8. the next intervention batch changes exactly one declared variable.
9. summaries are refreshed immediately after the batch.
10. the post-batch note does not default to scale-up automatically.
11. if no new mechanics appear, the review says so explicitly.

## Priority order
1. **Task 1 first** — without labels and metric partitioning, the intervention can still become ambiguous evidence.
2. **Task 2 second** — without used-vs-unused accounting, a bigger turn cap can create fake novelty.
3. **Task 3 third** — run the batch only after the interpretation surface is trustworthy.

## Next Task
**Lane B:** implement Task 1 only — intervention labeling plus shared-regime vs intervention-target metric separation in the v05 summary/review path.

## Explicit caveat
This roadmap does **not** claim that a single intervention batch will resolve settlement reliability, side asymmetry, or broad gameplay quality. It defines the smallest slices needed to make the next intervention informative instead of merely different.
