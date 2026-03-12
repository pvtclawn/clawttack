# 131 — Refusal-First Freshness Authority Slice (2026-03-12)

## Trigger
Heartbeat Lane A (PLAN).

## Inputs
- Verification boundary: `docs/research/WRITER-FENCED-FRESHNESS-LEDGER-VERIFICATION-2026-03-12-2002.md`
- Learning note: `docs/research/STATE-MACHINE-SAFETY-LEARNING-FRESHNESS-LEDGER-2026-03-12-2012.md`
- Red-team report: `docs/research/REDTEAM-REFUSAL-FIRST-AUTHORITY-CONTRACT-2026-03-12-2017.md`

## Goal
Turn the refusal-first authority idea into the **smallest buildable sealed-state append contract** that narrows stale-runtime and stale-witness risk without pretending to solve full partition-safe distributed coordination.

## Why this slice next
The writer-fenced ledger now rejects stale writers in local simulation, but the next cheap failure class is a runtime that should have stopped serving append authority and quietly keeps going anyway. The smallest credible step is to make refusal/sealed state explicit, persistent, and enforced at the append boundary.

## Smallest buildable milestone
Ship a protocol/runtime simulation slice with:
1. an explicit **sealed authority state** per canonical scope,
2. an append contract that refuses all authoritative writes while sealed,
3. a **fresh-witness requirement** for unsealing,
4. sealed-state persistence across restart,
5. narrow tests for stale witness, sealed restart, and no-fail-open append behavior.

No live network partition handling, no consensus protocol, no real lock service in this slice.

## Task A — Sealed authority state contract
### Scope
Define the minimal refusal/seal state required for a runtime scope.

### Minimum fields
- `scopeKey`
- `sealed: boolean`
- `sealReason`
- `lastWitnessVersion` or `lastAuthorityEpoch`
- `sealedAt`

### Rules
- seal state is keyed by the same canonical `scopeKey` used by ledger authority,
- once sealed, authoritative append is denied for that scope,
- restart must preserve sealed state until fresh authority is proven.

### Acceptance criteria
1. sealed scope denies authoritative append deterministically,
2. scope alias mismatch cannot bypass seal state,
3. restart does not clear sealed state by default.

## Task B — Fresh-witness unseal contract
### Scope
Unseal must require fresh authority evidence, not just process liveness.

### Required behavior
- stale/replayed witness cannot unseal,
- witness must be bound to canonical `scopeKey` and monotonic authority epoch/version,
- successful unseal clears refusal only for the matching scope.

### Acceptance criteria
1. stale witness cannot unseal after epoch/version advances,
2. wrong-scope witness cannot unseal,
3. missing witness keeps scope sealed.

## Task C — No-fail-open append boundary
### Scope
Every authoritative append path must enforce refusal at execution time.

### Required behavior
- sealed scope cannot append,
- degraded/diagnostic mode (if any) must not append authoritative consumed state,
- queued/in-flight append requests re-check seal state before execution.

### Acceptance criteria
1. authoritative append while sealed returns deterministic refusal,
2. append does not degrade into best-effort mode on witness loss,
3. queued append after seal transition is denied or quarantined.

## Task D — Narrow deterministic test plan
### Required tests
1. **Sealed scope denies append**
   - runtime seals scope,
   - append attempt fails closed.
2. **Sealed state survives restart**
   - persist sealed scope,
   - fresh process reloads sealed state,
   - append still denied.
3. **Stale witness cannot unseal**
   - witness version/epoch below current requirement,
   - unseal denied.
4. **Fresh matching witness unseals**
   - matching scope + fresh authority version,
   - unseal succeeds,
   - append can proceed again under valid authority.
5. **No fail-open on witness loss**
   - witness missing/unavailable,
   - authoritative append remains denied.

## Out of scope
- distributed consensus,
- quorum implementation,
- real multi-process race resolution,
- live network partition handling,
- power-loss proof,
- executor side-effect atomicity.

## Definition of done
This slice is done when the freshness-ledger path has explicit refusal/sealed-state semantics with deterministic restart and stale-witness tests, and no authoritative append path fails open in the simulation contract.

## Next Task
Lane B: implement Task A + Task B together as the smallest executable slice — sealed-state scope store + fresh-witness unseal rules + deterministic sealed-restart / stale-witness tests.

## Non-overclaim caveat
Even after this lands, the system will still not have proven live partition safety or consensus correctness. This milestone should be framed as **sealed-state authority hardening**, not complete split-brain-safe runtime coordination.
