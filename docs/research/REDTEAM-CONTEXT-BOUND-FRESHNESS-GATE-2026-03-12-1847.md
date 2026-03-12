# Red-Team — Context-Bound Capability Freshness Gate (2026-03-12 18:47 UTC)

## Trigger
Heartbeat Lane F (CHALLENGE).

## Scope
Red-team the proposed freshness/transition gate for context-bound capability execution.

## Target model
Proposed gate validates:
- run/thread binding
- turn binding
- context version/hash freshness
- single-use claim digest
- dependency validity

## Main question
Why might this still fail even if every individual check appears reasonable?

## Weakness 1 — Digest ambiguity / collision shaping
### Failure mode
If `claimDigest` is not computed over a **fully canonical, domain-separated payload**, an attacker can produce semantically different envelopes that collapse to the same replay key, or syntactically different serializations of the same claim that bypass duplicate detection.

### Exploit path
- vary field order / whitespace / omitted-default fields,
- omit battle/runtime namespace from the digest domain,
- hash only scope tuple but not execution-critical bindings.

### Consequence
Replay defense becomes non-deterministic: some true duplicates slip through, while some distinct claims alias incorrectly.

### Mitigation
Define `claimDigest = H(domain || schemaVersion || battleId || side || runId || turnIndex || contextVersion || normalizedScope || actionKind || actionPayload)` using one canonical encoder only.

### Acceptance criteria
- two differently serialized but semantically identical envelopes produce the **same** digest,
- any change to battle/run/turn/context/action fields produces a **different** digest,
- duplicate detection key is exactly the canonical digest, not ad hoc field subsets.

## Weakness 2 — Checkpoint rollback / consumed-state resurrection
### Failure mode
A checkpointed runtime can restore an earlier state where a claim appears unconsumed, even though it was already executed in a later branch/crash-recovery path.

### Exploit path
- execute claim,
- crash or restore from older checkpoint,
- replay same claim against resurrected pre-consumption state.

### Consequence
Single-use becomes branch-local instead of globally true. This is the classic "exactly-once via wishful thinking" trap.

### Mitigation
Persist consumed digests in a monotonic append-only ledger (or monotonic high-watermark + durable set) outside rollback-prone ephemeral runtime state. Recovery must reload consumed markers before accepting any queued claims.

### Acceptance criteria
- after simulated crash/restart from pre-consumption checkpoint, previously consumed digest is still denied,
- recovery path loads durable consumed state before processing pending claims,
- no execution path can commit side effects before durable consume-mark is recorded.

## Weakness 3 — Delayed delivery turns freshness into liveness griefing
### Failure mode
Strict turn/context freshness is safe, but an adversary can intentionally delay transport or flood stale claims so the gate rejects valid work after the runtime naturally advances.

### Exploit path
- hold a valid claim until the turn changes,
- deliver just late enough to force stale-turn/stale-context denial,
- repeat to waste agent effort or starve execution.

### Consequence
The system is replay-safe but operationally brittle; attackers can convert freshness checks into denial-of-service pressure.

### Mitigation
Separate **safety denial** from **liveness recovery**:
- deny stale execution,
- emit structured reason codes,
- allow deterministic re-issuance for the new turn/context,
- rate-limit stale-claim retries per source/runtime window.

### Acceptance criteria
- stale claims are denied with stable machine-readable reason codes,
- same logical action can be re-issued under current bindings without manual cleanup,
- repeated stale deliveries trigger bounded retry/rate-limit behavior instead of unbounded churn.

## Weakness 4 — Context hash can be too sensitive or too coarse
### Failure mode
If `contextHash` covers too much state, harmless changes constantly invalidate claims. If it covers too little state, security-relevant drift is missed.

### Exploit path
- attacker exploits untracked authorization-relevant field changes, or
- normal runtime noise causes needless stale-context failures.

### Consequence
Either false negatives (unsafe acceptance) or false positives (self-inflicted liveness collapse).

### Mitigation
Version/hash only the **authorization-relevant projection** of runtime state. Treat it as a deliberately designed state vector, not a dump of all context.

### Acceptance criteria
- non-authoritative/log-only state changes do **not** invalidate claims,
- every field that can change execution authority does invalidate claims,
- projection schema is explicit and versioned.

## Bottom line
The freshness gate is directionally correct, but by itself it is not enough. The real danger is treating replay defense as a local property of a single runtime snapshot. To hold under adversarial conditions, the design needs:
1. canonical domain-separated digests,
2. rollback-resistant consumed-state persistence,
3. explicit liveness handling for stale delivery,
4. a carefully scoped authorization-state projection.

## Recommended next build slice
Implement the smallest runtime contract for:
- canonical digest helper,
- durable consumed-digest store interface,
- machine-readable denial codes (`duplicate`, `wrong-runtime-binding`, `stale-turn`, `stale-context`),
- explicit authorization-state projection builder.

## Explicit caveat
This critique narrows the failure surface but does not prove the mechanism is now safe. It identifies the most likely cheap gaming paths to close before runtime wiring claims production confidence.
