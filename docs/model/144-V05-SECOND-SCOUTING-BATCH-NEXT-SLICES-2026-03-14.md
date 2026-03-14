# v05 Second Scouting Batch — Next Slices (2026-03-14)

## Trigger
Heartbeat Lane A (PLAN).

## Context
v05 has now crossed into real on-chain execution and a structured evidence loop:
- real turns mine,
- controlled low-volume batch runs work,
- concise per-battle summaries exist,
- aggregate summary artifacts exist.

That means the next question is no longer "can we collect anything at all?" It is:
- how do we run a **second small scouting batch** without fooling ourselves?

The latest red-team pass narrowed the main risks to:
1. same-regime overconfidence,
2. unsettled-battle blind spots,
3. hidden first-mover / side asymmetry,
4. overtrust in summaries vs raw artifacts,
5. overinterpretation of tiny deltas,
6. low-information repetition.

This roadmap keeps the next work small, evidence-oriented, and explicitly comparative.

## Task 1 — Batch-to-batch comparison + unsettled-battle accounting
### Goal
Make the second small batch comparable to the first in a way that highlights both repeated patterns and what remains missing.

### Smallest buildable contract
- extend or post-process the aggregate summaries so the next review includes:
  - comparison against the previous aggregate,
  - unsettled/active battle count,
  - first-mover distribution,
  - observed vs unobserved mechanics,
  - notable repeated anomalies.

### Acceptance criteria
1. the second batch review explicitly compares itself to the first batch.
2. unsettled/active battle count is visible in the comparison output.
3. first-mover distribution is visible in the comparison output.
4. observed vs unobserved mechanics remain explicit so missing later-turn coverage is not mistaken for clean health.

## Task 2 — Second controlled 3–5 battle scouting run
### Goal
Replicate the current live regime once more without pretending the second batch proves general robustness.

### Smallest buildable contract
- run another 3–5 battle batch under current controlled settings,
- refresh per-battle and aggregate summaries,
- preserve explicit identity-pair / first-mover metadata.

### Acceptance criteria
5. batch size remains in the 3–5 range.
6. summaries are refreshed immediately after the batch.
7. the resulting batch can be compared to the prior one without raw-log archaeology.

## Task 3 — Post-batch decision gate: replicate vs vary vs instrument
### Goal
Prevent blind repetition once the second batch is complete.

### Smallest buildable contract
- after the second batch, explicitly decide one of:
  - replicate again,
  - vary a parameter,
  - add instrumentation,
- based on whether the second batch exposed new mechanics or merely repeated the first batch's evidence.

### Acceptance criteria
8. the post-batch note does not default to scale-up automatically.
9. the next step is justified by comparison evidence, not vibes.
10. if no new mechanics are observed, the note says so explicitly.

## Priority order
1. **Task 1 first** — without explicit comparison, the second batch can still be narrativized too loosely.
2. **Task 2 second** — controlled replication once the comparison surface exists.
3. **Task 3 third** — keeps the evidence loop honest after the second batch finishes.

## Next Task
**Lane B:** implement Task 1 only — batch-to-batch comparison + unsettled-battle accounting for the next v05 scouting review.

## Explicit caveat
This roadmap does **not** claim that a second 3–5 battle batch will settle gameplay quality. It defines the next narrow slices required to make replication informative rather than self-hypnotic.
