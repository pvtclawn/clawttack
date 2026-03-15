# V05 Challenge — run-context sidecar risks (2026-03-15 12:02 UTC)

## Trigger
Heartbeat Lane F after proposing a minimal per-battle run-context sidecar for the next real agent-vs-agent battle.

## Question
Why might the run-context sidecar create false confidence, and how should it be constrained before implementation?

## Core critique
A sidecar is useful only if it remains a **trace of observations**.
If it quietly becomes a source of asserted truth, it can make battle evidence look cleaner than reality.

## Weaknesses

### 1) Sidecar drift from actual battle state
**Risk:** the JSON file is created early and then stops updating after a crash, partial restart, or path mismatch.

**Failure mode:**
- `battleId` and `battleAddress` remain correct,
- `acceptedOnChain` stays `false` because the updater never ran,
- later diagnosis mistakes a stale sidecar for a real accept gap.

**Mitigation:**
- include `lastUpdatedAt` and `lastUpdateSource`,
- treat missing fresh updates as `indeterminate`, not `false`,
- record whether the run exited cleanly or not.

### 2) Wrong battle binding after retries or cloned battles
**Risk:** the harness can accidentally keep writing to the first sidecar while the live runner proceeds with a different battle id/address.

**Failure mode:**
- metadata looks coherent,
- but it describes the wrong battle,
- summarizer produces precise nonsense.

**Mitigation:**
- make `battleId` + `battleAddress` immutable once bound,
- if a retry creates a new battle, create a new sidecar,
- fail closed on any mismatch between sidecar identity and checkpoint/log identity.

### 3) Sidecar values can be inferred too optimistically
**Risk:** `acceptedOnChain=true` or `terminalOnChain=true` may get written from one optimistic read or from a weak inference instead of a durable observation.

**Failure mode:**
- sidecar upgrades a boundary before it is stable,
- summarizer trusts the field shape,
- the artifact appears more authoritative than the observation deserved.

**Mitigation:**
- record `acceptedObservationMethod` / `terminalObservationMethod`,
- record block number / tx hash / event anchor when available,
- prefer `indeterminate` when the observation is weak.

### 4) firstMissingBoundary can become narrative rather than diagnosis
**Risk:** an early heuristic writes `firstMissingBoundary`, but later evidence would have changed that conclusion.

**Failure mode:**
- the sidecar tells a nice story too early,
- later processors inherit that story instead of recomputing from evidence.

**Mitigation:**
- treat `firstMissingBoundary` as derived, not authoritative,
- store raw milestone observations separately,
- recompute boundary classification during summarization whenever possible.

### 5) The sidecar can hide uncertainty by forcing booleans
**Risk:** `acceptedOnChain=false` could mean:
- not observed,
- checked and absent,
- RPC failed,
- updater crashed,
- race condition during polling.

**Failure mode:**
- false negatives become indistinguishable from true absence,
- the next run gets misclassified with high confidence.

**Mitigation:**
- use tri-state fields (`observed|absent|indeterminate`) or add a parallel confidence field,
- preserve observation errors explicitly.

### 6) Humans may overtrust the sidecar because it looks structured
**Risk:** a neat JSON file gets treated as better evidence than messy logs/checkpoints, even when it is downstream of them.

**Failure mode:**
- reviewers stop checking raw artifacts,
- subtle inconsistencies pass unnoticed,
- the sidecar becomes an accidental fiction layer.

**Mitigation:**
- state explicitly that the sidecar is an observation ledger, not canonical truth,
- include pointers/hashes to the raw log/checkpoint sources,
- require summarizer mismatch warnings when sidecar and raw artifacts disagree.

## Smallest hardened version
Before implementation, strengthen the sidecar to include:
- immutable `battleId` + `battleAddress` binding,
- `lastUpdatedAt`,
- `lastUpdateSource`,
- observation method/error fields,
- tri-state milestone semantics,
- mismatch/fail-closed behavior when sidecar identity disagrees with raw artifacts.

## Recommended next step
Do **not** implement the sidecar as a plain optimistic boolean cache.
Implement it as a lightweight observation ledger with explicit uncertainty and identity binding.

## Bottom line
The sidecar is worth doing, but only if it stays humble:

> a breadcrumb trail for later verification, not a magical source of battle truth.
