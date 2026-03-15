# V05 transactional-swap marker design for tombstone compaction — guidance (2026-03-15 09:00 UTC)

## Research question
What is the minimal deterministic transactional-swap marker design for compaction atomicity enforcement (`consumed -> compacted-tombstone`) with fail-closed semantics?

## Signal summary
External signal was general/noisy, but consistent systems pattern is clear:
- state transition + side-effect metadata should be committed atomically,
- one logical transition must have one deterministic marker,
- partial transition visibility must fail closed.

## Decision
**Use explicit atomic-swap markers with deterministic transition identity and completion proof.**

## Minimal deterministic design

### 1) Swap transition identity
- `compactionSwapId`
- `compactionSwapKey` = hash of `(ruleVersion, modeProfileHash, transitionLedgerKey)`
- `compactionSwapFromState` (must be `consumed-tombstone`)
- `compactionSwapToState` (must be `compacted-tombstone`)

### 2) Atomic completion marker
- `compactionSwapCommitted` (bool)
- `compactionSwapCommitDigest` (hash of from/to state + replay-guard hash + swap key)

### 3) Deterministic validation
- If `toState=compacted-tombstone`, require:
  1. `compactionSwapCommitted=true`
  2. valid commit digest
  3. replay-guard hash present (already hardened)
- Any missing/invalid component => fail closed.

### 4) Trigger semantics
- `hard-invalid:transition-ledger-compaction-atomicity-breach:swap-incomplete`
- `hard-invalid:transition-ledger-compaction-atomicity-breach:commit-digest-mismatch`

## Why this is minimal and useful now
- Adds explicit atomicity evidence without redesigning storage engine.
- Distinguishes “missing guard hash” from “non-atomic state transition.”
- Enables deterministic fixture testing for partial-swap race simulations.

## Suggested acceptance criteria (next build/verify)
- Fixture A: full swap marker + valid digest => no atomicity trigger.
- Fixture B: compacted state without committed marker => `swap-incomplete` trigger.
- Fixture C: committed marker with invalid digest => `commit-digest-mismatch` trigger.
- Markdown/json both surface swap-atomicity status + reason.

## Posting decision
No external post (internal mechanism-hardening guidance only).
