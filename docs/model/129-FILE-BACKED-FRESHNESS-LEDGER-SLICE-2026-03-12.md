# 129 — File-Backed Freshness Ledger Slice (2026-03-12)

## Trigger
Heartbeat Lane A (PLAN).

## Inputs
- Verification boundary: `docs/research/RUNTIME-FRESHNESS-GATE-VERIFICATION-2026-03-12-1905.md`
- Recovery learning: `docs/research/DURABLE-EXECUTION-LEARNING-FRESHNESS-GATE-2026-03-12-1911.md`
- Red-team report: `docs/research/REDTEAM-FILE-BACKED-CONSUMED-DIGEST-LEDGER-2026-03-12-1916.md`

## Goal
Turn the file-backed consumed-digest ledger idea into the **smallest buildable adapter** that improves restart-safe duplicate denial without pretending the full runtime is now crash-proof.

## Why this slice next
The current freshness gate is deterministic only within one live process. The next cheapest missing guarantee is restart-surviving duplicate denial. The smallest credible step is a file-backed ledger adapter plus narrow recovery tests.

## Smallest buildable milestone
Ship a protocol/runtime simulation slice with:
1. a **versioned append-only ledger record format**,
2. a **file-backed consumed-digest store adapter**,
3. a **sealed startup/load path**,
4. narrow tests for **restart recovery**, **trailing partial write**, and **corruption detection**.

No executor-side effects, no compaction, no queue runner in this slice.

## Task A — Ledger record format
### Scope
Define an append-only record with explicit schema version and corruption detection.

### Minimal record fields
- `schemaVersion`
- `digest`
- `battleId`
- `runId`
- `turnIndex`
- `contextVersion`
- `timestamp`
- `checksum`

### Format rule
Use strict JSONL where each complete line is one record. Recovery must reject malformed lines or checksum mismatches; trailing partial lines are not silently accepted as valid history.

### Acceptance criteria
1. valid records load deterministically into a consumed set,
2. truncated trailing line is detected explicitly,
3. checksum mismatch is detected explicitly,
4. duplicate valid entries reconstruct to consumed=true.

## Task B — File-backed consumed-digest adapter
### Scope
Implement a store adapter that appends consumed records durably and can rebuild an in-memory consumed index from disk.

### Required interface behavior
- `load()` populates consumed state before use,
- `has(digest)` answers against loaded durable state,
- `markConsumed(...)` appends one durable record and only returns success after the durability boundary is crossed.

### Acceptance criteria
1. calling `has` before successful `load` is impossible or fail-closed,
2. successful `markConsumed` persists a record that survives a fresh adapter instance,
3. second adapter process loading the same file denies the same digest as consumed.

## Task C — Sealed startup / fail-closed recovery
### Scope
The adapter must begin in a sealed state until ledger load succeeds.

### Acceptance criteria
1. evaluation cannot proceed against an unloaded ledger,
2. corrupted ledger load yields explicit failure / sealed mode,
3. permissive empty-state fallback is not allowed on load failure.

## Task D — Narrow restart/corruption test plan
### Required tests
1. **Restart-surviving duplicate denial**
   - mark digest consumed,
   - create fresh adapter instance on same ledger file,
   - loaded adapter reports digest consumed.
2. **Trailing partial record detection**
   - simulate truncated final line,
   - loader rejects the ledger deterministically.
3. **Checksum corruption detection**
   - mutate stored record payload or checksum,
   - loader rejects deterministically.
4. **Duplicate row stability**
   - two valid records for same digest still reconstruct to consumed=true.

## Out of scope
- fsync/power-loss integration proof across real filesystems,
- compaction/snapshotting,
- concurrent multi-writer coordination,
- queue recovery order orchestration,
- executor atomicity with side effects.

## Definition of done
This slice is done when a new protocol/runtime simulation adapter exists with deterministic restart/corruption tests and an explicit fail-closed recovery boundary.

## Next Task
Lane B: implement Task A + Task B together as the smallest executable slice — versioned JSONL ledger format with checksum + file-backed consumed-digest adapter + restart-surviving duplicate test.

## Non-overclaim caveat
Even after this lands, the system still will not have proven power-loss durability, multi-writer safety, or end-to-end executor atomicity. This milestone should be framed as **restart-safe ledger hardening**, not full durable exactly-once execution.
