# V05 Challenge — completionEvidence overclaim risks (2026-03-15 11:32 UTC)

## Trigger
Heartbeat Lane F after proposing a minimal `completionEvidence` block for the next controlled battle run.

## Question
Why might the proposed `completionEvidence` slice still fail, mislead, or create a new route to false confidence?

## Core critique
`completionEvidence` is directionally right, but if implemented naively it can become **a prettier ambiguity layer** rather than a truth anchor.

## Weaknesses

### 1) Chain observation can be stale, partial, or from the wrong read point
**Risk:** `chainObserved=true` may be recorded from a lagging RPC, stale cache, wrong block height, or transient read inconsistency.
That would make the artifact look stronger than it is.

**Failure mode:**
- runner sees terminal state on one poll,
- later query disagrees,
- artifact preserves only the optimistic read,
- report upgrades the run from "unproven" to "terminal observed" too easily.

**Mitigation:**
- record the exact observation source and block number for each `chainObserved` milestone,
- require terminal-state confirmation on at least two consecutive reads or a receipt/log anchor before elevating terminal truth,
- default to `chainObserved=indeterminate` instead of forced boolean when the read boundary is noisy.

### 2) Log truth and chain truth are not equally authoritative
**Risk:** a symmetric schema (`logObserved` vs `chainObserved`) can accidentally imply they have equal evidentiary weight.
They do not.

**Failure mode:**
- markdown/report language treats `logObserved=false, chainObserved=true` as a mere discrepancy,
- humans read the artifact casually and miss that chain truth should dominate.

**Mitigation:**
- add an explicit `authority` or `resolvedBy` field,
- define ordering up front: `receipt/event or final on-chain state > direct RPC state read > runner log token`,
- ensure summaries phrase divergence as `artifact/logging gap`, not "mixed evidence".

### 3) Boolean milestones may hide important intermediate uncertainty
**Risk:** `accepted: false` conflates:
- not yet checked,
- checked and absent,
- unreadable because RPC/log path failed,
- observed once but not stabilized.

**Failure mode:**
- false negatives get interpreted as lifecycle failure,
- next patch chases the wrong boundary.

**Mitigation:**
- use tri-state or enum values: `observed | absent | indeterminate`,
- preserve `observationError` / `observationMethod` alongside the milestone.

### 4) A single divergenceBoundary can oversimplify multi-boundary failure
**Risk:** one string like `accepted|terminal|none` may hide compound cases.

**Failure mode:**
- accept was observed only in logs,
- terminal was observed only on-chain,
- artifact records just one divergence boundary,
- diagnosis loses causal detail.

**Mitigation:**
- store per-milestone divergence, not only one summary boundary,
- keep `divergenceBoundary` as a derived headline, not the only forensic field.

### 5) Terminal state can be operationally real but not product-meaningful
**Risk:** a battle can end via timeout/cleanup/manual resolution and still look like "terminal observed".
That is useful, but not equivalent to a compelling proper battle.

**Failure mode:**
- system starts counting terminal evidence as strong gameplay proof,
- public/internal language quietly slides from "terminal lifecycle observed" to "proper battle achieved".

**Mitigation:**
- split `terminalObserved` from `properBattleSatisfied`,
- attach `terminalKind` such as `winner`, `timeout`, `cleanup`, `unknown-terminal`,
- never let the instrumentation slice by itself upgrade the proper-battle verdict.

### 6) This can still be gamed by selective artifact retention
**Risk:** if only the cleanest milestone snapshots are persisted, the artifact becomes a curated narrative instead of a diagnostic record.

**Failure mode:**
- noisy or contradictory reads disappear,
- final artifact looks cleaner than the actual run,
- future work optimizes for the artifact instead of the truth.

**Mitigation:**
- record first observation and final observation timestamps,
- preserve raw observation excerpts or hashes when feasible,
- fail closed when milestone evidence was rewritten or replaced mid-run.

## Recommended hardened version
Before implementation, strengthen the slice to something like:
- per milestone: `status = observed|absent|indeterminate`
- `observationMethod`
- `observationBlockNumber` / tx hash / receipt anchor when available
- `authority`
- `terminalKind`
- per-milestone divergence, with summary divergence as derived output only

## Smallest safe next step
Do **not** implement the original boolean-only version unchanged.
Instead, patch the minimal slice to:
1. use tri-state milestone status,
2. distinguish authoritative source,
3. separate `terminalObserved` from `properBattleSatisfied`.

## Bottom line
`completionEvidence` is worth doing, but the naive shape is too easy to overread.

The real target is:

> better diagnosis without creating a fake sense that partial on-chain observation equals a proven proper battle.
