# v05 Low-Volume Batch Collection — Next Slices (2026-03-14)

## Trigger
Heartbeat Lane A (PLAN).

## Context
v05 has now crossed the key threshold from setup smoke into real on-chain play:
- deterministic bootstrap works,
- battle creation works,
- battle acceptance works,
- real turn submissions have mined on Base Sepolia.

That means the next goal is no longer "prove any live turn exists." It is:
- run a **small, structured scouting batch**,
- collect useful gameplay evidence,
- avoid overclaiming from tiny samples,
- preserve clear failure-stage diagnostics before scaling battle count.

The latest red-team pass narrowed the main risks around low-volume collection to:
1. success bias from one or two photogenic battles,
2. identity-pair overfitting,
3. unobserved later-turn mechanics,
4. noisy metrics,
5. false confidence from tiny denominators,
6. instrumentation gaps.

This roadmap keeps the next work small, operationally useful, and explicitly testable.

## Task 1 — Concise per-battle summaries + aggregate stage/result summary
### Goal
Make the next 3–5 battle scouting batch interpretable without raw log archaeology.

### Smallest buildable contract
- emit one concise machine-readable and human-readable summary per battle capturing:
  - battle id/address,
  - agent IDs / identity pair,
  - first mover,
  - deepest stage reached,
  - turns mined,
  - tx hashes,
  - bank deltas,
  - failure class or settlement/result type,
- emit one aggregate summary after the batch capturing:
  - battle count,
  - stage histogram,
  - turns-reached distribution,
  - bank-delta overview,
  - observed/unobserved mechanics,
  - notable anomalies.

### Acceptance criteria
1. every battle in the next batch produces a concise summary artifact.
2. the batch produces one aggregate summary artifact.
3. stage-specific failures are counted explicitly rather than buried in raw exceptions.
4. summaries record first mover and current identity pair so early results are not misread as general multi-agent truths.

## Task 2 — Controlled 3–5 battle scouting run
### Goal
Gather the first small batch of real gameplay evidence without prematurely scaling volume.

### Smallest buildable contract
- run a low-volume batch (3–5 battles),
- keep zero/low stake and current controlled runner settings,
- stop early if a repeated hard failure class appears,
- preserve all artifacts under `battle-results/`.

### Acceptance criteria
5. batch size stays in the 3–5 range.
6. repeated stage failures are surfaced quickly instead of allowing blind longer runs.
7. the resulting batch gives a directional picture of which stages are stable and which still fail.

## Task 3 — Explicit observed vs unobserved mechanics accounting
### Goal
Prevent the next batch from looking more informative than it really is.

### Smallest buildable contract
- after the batch, explicitly list which mechanics were observed:
  - first turns,
  - later turns,
  - active poison,
  - VOP behavior,
  - reveal cycles,
  - settlement/result types,
- and which mechanics still were **not** observed.

### Acceptance criteria
8. the aggregate summary distinguishes observed from unobserved mechanics.
9. no scale-up recommendation is made without that observed/unobserved list.
10. the batch is framed as exploratory evidence, not as a verdict on final gameplay quality.

## Priority order
1. **Task 1 first** — without summaries, the batch remains haunted and expensive to learn from.
2. **Task 2 second** — actual controlled collection once summaries exist.
3. **Task 3 third** — prevents overclaim after the batch completes.

## Next Task
**Lane B:** implement Task 1 only — concise per-battle summaries plus one aggregate stage/result summary for the next low-volume v05 scouting batch.

## Explicit caveat
This roadmap does **not** claim that a 3–5 battle batch will tell us whether v05 gameplay is definitively good. It defines the next narrow slices needed to collect useful evidence without pretending a tiny sample is a final verdict.
