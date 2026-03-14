# 155 — V05 runtime failure subtype mapping next slices (2026-03-14)

## Context
Latest strict intervention refresh keeps one `runtime/generic` anomaly while `unsettledShare` stays high in tiny windows. Before any volume increase, runtime failures need subtype clarity and one strict confirmation sample gate.

## Task 1 (P0) — Runtime subtype mapping in summarizer
Implement deterministic subtype classification under `runtime/*` in `packages/sdk/scripts/summarize-v05-batches.py`.

Target first subclasses:
- `runtime/turn-construction`
- `runtime/submit-estimation`
- `runtime/submit-transaction`
- `runtime/checkpoint-or-state`
- fallback `runtime/generic`

### Acceptance
1. Refreshed aggregate `failureHistogram` can show specific `runtime/*` subclasses.
2. Per-battle outputs keep both `failureClass` and raw `failureDetail`.
3. JSON/Markdown parity remains intact for new subclass labels.

## Task 2 (P0) — Strict confirmation-sample gate
Run one additional low-volume strict intervention sample after subtype patch.

### Acceptance
1. Strict run completes with `strictViolationCount=0`.
2. No new `interface-decode/*` signatures appear.
3. Any residual runtime failure is subtype-labeled (not collapsed to opaque generic unless no classifier match).

## Task 3 (P1) — Scale-up gate wording
Keep scale-up blocked unless confirmation sample is clean enough to interpret.

### Acceptance
1. Reliability note explicitly states exploratory status and settlement gap.
2. No battle-volume increase decision recorded unless confirmation criteria are met.

## Priority
Execute **Task 1** next (smallest blocker-removal slice for evidence quality).