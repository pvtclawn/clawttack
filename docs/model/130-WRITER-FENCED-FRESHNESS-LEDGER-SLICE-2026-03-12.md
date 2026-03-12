# 130 — Writer-Fenced Freshness Ledger Slice (2026-03-12)

## Trigger
Heartbeat Lane A (PLAN).

## Inputs
- Verification boundary: `docs/research/FILE-BACKED-FRESHNESS-LEDGER-VERIFICATION-2026-03-12-1931.md`
- Recovery learning: `docs/research/APPEND-ONLY-LOG-LEARNING-FRESHNESS-LEDGER-2026-03-12-1941.md`
- Red-team report: `docs/research/REDTEAM-WRITER-FENCED-FRESHNESS-LEDGER-2026-03-12-1946.md`
- Existing fencing primitive: `packages/protocol/src/single-writer-fencing.ts`

## Goal
Turn the writer-fenced ledger idea into the **smallest buildable append contract** that narrows split-brain and stale-writer risk without pretending to solve full multi-process distributed coordination.

## Why this slice next
The file-backed freshness ledger now survives restart in a single-process simulation. The next cheapest unresolved failure class is contradictory authoritative history from stale, split-brain, or wrong-scope writers.

## Smallest buildable milestone
Ship a protocol/runtime simulation slice with:
1. a **canonical authority artifact shape**,
2. a **writer-fenced append guard** bound to canonical scope,
3. a **durable record embedding the writer token/epoch**,
4. narrow tests for **missing authority**, **stale token**, **scope mismatch**, **token regression**, and **restart + valid writer**.

No live lock service, no multi-process orchestration, no consensus protocol in this slice.

## Task A — Authority artifact contract
### Scope
Define the minimal shared authority state required for a writer-fenced ledger append.

### Minimum authority fields
- `scopeKey`
- `ownerId`
- `activeToken`
- `tokenFloor`

### Rules
- `scopeKey` must canonically bind the ledger authority domain,
- `activeToken` is the only currently valid writer token,
- `tokenFloor` prevents epoch/token regression after rollback,
- missing or corrupt authority state fails closed.

### Acceptance criteria
1. append cannot proceed without authority state,
2. authority state with wrong `scopeKey` is rejected,
3. token regression below floor is rejected deterministically.

## Task B — Fenced append contract
### Scope
Create one append boundary that couples authority validation and durable ledger write.

### Required behavior
Before durable append:
1. validate writer authority against current authority artifact,
2. validate append scope against authority scope,
3. include `writerToken` in the durable record,
4. append only if authority passes.

### Acceptance criteria
1. stale/wrong writer cannot append,
2. wrong scope cannot append,
3. durable record contains writer token/epoch,
4. no loose “check first, write later” helper is treated as sufficient proof of authority.

## Task C — Deterministic failure tests
### Required tests
1. **Missing authority fails closed**
   - no authority artifact => non-append outcome.
2. **Stale token denied**
   - wrong owner or stale token => deterministic denial.
3. **Token regression denied**
   - `activeToken < tokenFloor` => deterministic denial.
4. **Scope mismatch denied**
   - valid writer for scope A cannot append to scope B.
5. **Restart + valid writer preserves duplicate denial**
   - under valid authority state, consumed digest survives restart and denies replay.
6. **Record embeds authority epoch**
   - appended durable record includes the writer token so stale-authority writes are auditable.

## Out of scope
- lock acquisition protocol,
- live multi-process race resolution,
- cross-machine consensus,
- end-to-end executor-side-effect atomicity,
- real power-loss proof.

## Definition of done
This slice is done when the freshness-ledger adapter exposes a writer-fenced append contract with deterministic failure tests and explicit fail-closed authority semantics.

## Next Task
Lane B: implement Task A + Task B together as the smallest executable slice — authority artifact type + fenced append path + durable writer-token embedding + deterministic stale-token/scope-mismatch tests.

## Non-overclaim caveat
Even after this lands, the system will still not have proven real multi-process linearizability or distributed consensus. This milestone should be framed as **authority-aware append hardening**, not complete split-brain-proof durable execution.
