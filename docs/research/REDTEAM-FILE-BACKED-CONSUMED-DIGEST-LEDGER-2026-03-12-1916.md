# Red-Team — File-Backed Consumed-Digest Ledger (2026-03-12 19:16 UTC)

## Trigger
Heartbeat Lane F (CHALLENGE).

## Scope
Red-team the proposed file-backed consumed-digest ledger for runtime freshness-gate recovery.

## Proposed target
A durable append-only ledger backing duplicate denial for `claimDigest`, with recovery behavior:
1. append consumed record on allow-path,
2. rebuild in-memory index from file on startup,
3. deny any recovered digest as `duplicate`.

## Main question
Why might a simple file-backed ledger still fail under realistic crash-recovery and adversarial conditions?

## Weakness 1 — Partial write / torn line acceptance
### Failure mode
If records are appended as plain text/JSON lines without atomicity checks, a crash can leave a truncated final record that is still partially parseable or silently ignored.

### Exploit path
- allow-path begins append,
- process crashes mid-write,
- recovery loader either:
  - accepts malformed record incorrectly, or
  - drops the final incomplete record and forgets the already-consumed digest.

### Consequence
Duplicate denial becomes dependent on parser luck. A consumed digest can resurrect after crash.

### Mitigation
- Use framed records with length/checksum or strict JSONL + end-of-line completeness validation.
- Treat trailing partial record as corruption requiring explicit truncation/recovery handling.
- fsync the append before returning success.

### Acceptance criteria
1. crash after half-record write never yields silent successful recovery,
2. malformed trailing record is detected deterministically,
3. no allow-path succeeds unless durable append is fully committed.

## Weakness 2 — Ack-before-fsync lies about single-use
### Failure mode
Even if the record is written to a file buffer, returning success before fsync (or equivalent durability barrier) means a power loss/crash can erase the consumed marker after the caller already observed success.

### Exploit path
- gate returns `allow`,
- caller/executor acts on it,
- OS or runtime has not durably flushed the record,
- crash happens,
- recovery misses the digest and re-allows replay.

### Consequence
The system looks replay-safe in process-local tests but is not actually durable.

### Mitigation
- Define durability boundary explicitly: append + flush + fsync must complete before success is surfaced.
- If fsync fails, surface failure and do not acknowledge single-use authorization.

### Acceptance criteria
1. no externally visible allow result occurs before durability barrier completion,
2. simulated fsync failure yields non-success outcome,
3. replay after crash is denied only when pre-crash success was truly durable.

## Weakness 3 — Recovery ordering bug lets queued replay race the ledger load
### Failure mode
On restart, queued claims may be processed before the consumed index is fully reconstructed from disk.

### Exploit path
- process restarts,
- queued retry arrives immediately,
- recovery path starts handling requests before ledger load completes,
- stale duplicate slips through the empty in-memory index.

### Consequence
Replay safety becomes timing-dependent and brittle under load.

### Mitigation
- Gate must start in a sealed recovery state.
- No claim evaluation until ledger load completes successfully.
- Failed/incomplete ledger load must fail closed for execution.

### Acceptance criteria
1. startup path blocks claim handling until ledger load finishes,
2. queued replay during recovery is denied or deferred deterministically,
3. ledger-load failure does not degrade into permissive empty-state execution.

## Weakness 4 — Duplicate ledger entries / compaction drift
### Failure mode
Append-only ledgers accumulate duplicate rows, schema drift, or future compaction bugs that rebuild the wrong index.

### Exploit path
- same digest appended multiple times under retries,
- compactor drops newest/oldest entry incorrectly,
- schema upgrade misreads earlier records,
- recovery reconstructs inconsistent digest set.

### Consequence
Recovery correctness depends on maintenance tools rather than the core safety invariant.

### Mitigation
- Make ledger semantics set-like: presence of any valid record for a digest means consumed.
- Version records explicitly.
- Treat compaction as a derived optimization with invariant tests against raw-log replay.

### Acceptance criteria
1. multiple valid entries for the same digest still reconstruct to consumed=true,
2. schema version mismatch is explicit and fail-closed,
3. compacted index must match raw replay result exactly in tests.

## Weakness 5 — File corruption turns safety into accidental amnesia
### Failure mode
Disk corruption, manual edits, or partial truncation can remove consumed history without obvious runtime detection.

### Exploit path
- ledger file damaged or edited,
- recovery silently skips unreadable rows,
- digest disappears from recovered index,
- replay becomes allowed.

### Consequence
A single damaged file can erase the only evidence of prior consumption.

### Mitigation
- Add per-record checksum and optional rolling hash / manifest.
- Detect corruption explicitly and fail closed for execution until repaired.
- Consider snapshot + log design so one bad tail segment does not erase the full set.

### Acceptance criteria
1. corrupted record is detected, not silently skipped into permissive state,
2. corruption produces explicit recovery failure or sealed mode,
3. valid prefix recovery behavior is specified rather than accidental.

## Bottom line
A file-backed consumed-digest ledger is the right next direction, but only if treated as a **recovery-critical data structure**, not a convenience cache dump. The cheap failure modes are:
1. partial/torn writes,
2. ack-before-fsync,
3. recovery-order race,
4. compaction/index drift,
5. corruption-induced amnesia.

## Recommended next build slice
Implement the smallest ledger adapter with:
- strict append format,
- explicit durability barrier before success,
- startup sealed mode until ledger load completes,
- checksum/versioned records,
- restart-surviving duplicate test,
- corruption/partial-write tests.

## Explicit caveat
This red-team artifact narrows the design surface but does not prove the ledger design safe. It identifies the most likely low-cost ways a seemingly correct durable ledger would still betray replay safety.
