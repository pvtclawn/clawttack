# v05 Turn-Budget Accounting — Implementation Next Slices (2026-03-14)

## Trigger
Heartbeat Lane A (PLAN).

## Context
Lane F red-team (09:44) narrowed the pre-build risks for turn-budget accounting:
1. budget usage can be mis-attributed when battles end early for non-budget reasons,
2. turn-index semantics can drift (`turns mined` vs chain `currentTurn`),
3. tiny-sample used/unused ratios are easy to overclaim,
4. missing/dirty control-vs-intervention labels can contaminate comparisons,
5. unsettled battles create snapshot-time ambiguity.

The next slice should produce a strict implementation contract before Lane B coding.

## Task 1 — Canonical turn-budget usage semantics (single source of truth)
### Goal
Define one deterministic formula for whether intervention turn budget was actually exercised.

### Implementation contract
In summary generation:
- use one canonical derived value per battle:
  - `turnBudgetConfigured`
  - `turnsMined`
  - `turnBudgetUsed = turnsMined >= turnBudgetConfigured`
- keep this derivation in one helper path so per-battle and aggregate outputs cannot drift.
- annotate early stop context separately (failure/stage/settled state), rather than encoding it into the usage boolean.

### Acceptance criteria
1. per-battle output always includes `turnBudgetConfigured`, `turnsMined`, `turnBudgetUsed`.
2. `turnBudgetUsed` is computed from the same helper for all outputs.
3. early termination reasons remain explicit in existing stage/failure fields (no hidden overloading).

## Task 2 — Partitioned aggregate accounting under intervention-target metrics
### Goal
Keep budget-usage evidence clearly intervention-scoped and avoid contaminating shared-regime health metrics.

### Implementation contract
In aggregate output:
- add intervention-target fields only:
  - `turnBudgetUsedBattleCount`
  - `turnBudgetUnusedBattleCount`
  - `turnBudgetUsedRatio`
- preserve existing shared-regime metrics unchanged.
- retain settled/unsettled counts and labels so usage is interpreted with state context.

### Acceptance criteria
4. used/unused/ratio appears under `interventionTargetMetrics` only.
5. shared-regime metrics remain structurally unchanged.
6. settled/unsettled counts remain visible in aggregate output.

## Task 3 — Tiny-sample caveat + label hygiene gate
### Goal
Prevent overclaiming from small intervention windows and ensure control/intervention identity is explicit.

### Implementation contract
- keep/require control and intervention labels in output headers.
- add a markdown caveat section that explicitly warns when denominator is tiny.
- include current observed/unobserved mechanics block in the same report section.

### Acceptance criteria
7. markdown summary includes explicit control/intervention labels.
8. markdown summary includes a tiny-sample caution tied to battle count.
9. observed vs unobserved mechanics remains explicit alongside turn-budget usage.

## Priority order
1. Task 1 first (avoid semantic drift).
2. Task 2 second (correct metric placement).
3. Task 3 third (interpretation safety).

## Next Task
**Lane B:** implement Task 1 only in `packages/sdk/scripts/summarize-v05-batches.py` (canonical per-battle turn-budget usage fields).

## Explicit caveat
This roadmap does **not** claim intervention success or gameplay improvement. It only defines the smallest deterministic accounting slice needed before coding and rerunning a labeled intervention batch.
