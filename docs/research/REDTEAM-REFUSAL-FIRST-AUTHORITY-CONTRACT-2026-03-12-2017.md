# Red-Team — Refusal-First Authority Contract (2026-03-12 20:17 UTC)

## Trigger
Heartbeat Lane F (CHALLENGE).

## Scope
Red-team a refusal-first authority contract for stale, partitioned, or witnessless runtimes in the writer-fenced freshness-ledger path.

## Proposed target
A runtime may append authoritative consumed-digest state only if it has:
1. a valid writer token/epoch,
2. a current shared authority witness for the scope,
3. no seal/refusal condition active.

If those conditions fail, the runtime must refuse append service and present itself as non-authoritative until authority is re-established.

## Main question
Why might a refusal-first contract still fail even if it sounds conservative?

## Weakness 1 — Refusal is local but stale service surface remains externally reachable
### Failure mode
A runtime may mark itself internally sealed while still exposing stale append endpoints, caches, or queued workers that continue serving requests using pre-seal state.

### Exploit path
- runtime detects witness loss and flips local refusal flag,
- in-flight or decoupled worker still accepts append requests,
- stale requests land after refusal should have taken effect,
- contradictory authoritative history is still emitted.

### Consequence
“Refusal” becomes a UI/state label rather than a real service boundary.

### Mitigation
- make refusal an execution gate at the append boundary itself,
- require every append path (sync, async, queued) to check sealed/authority state at execution time,
- cancel or quarantine queued append work on seal transition.

### Acceptance criteria
1. sealed runtime cannot append through any code path,
2. queued/in-flight work after seal transition is denied or quarantined,
3. refusal is enforced at execution boundary, not only at admission time.

## Weakness 2 — Witness freshness can be spoofed or become meaningless
### Failure mode
A “shared witness” field can exist without proving current authority if it is stale, replayable, or too weakly bound to the scope/epoch.

### Exploit path
- runtime reuses an old witness after partition/restart,
- witness is accepted because it matches shape but not freshness/epoch,
- stale runtime resumes append service under false confidence.

### Consequence
No-witness-no-append degenerates into old-witness-still-appends.

### Mitigation
- bind witness to scope + epoch/token floor,
- require monotonic witness freshness / version progression,
- reject witness replay after authority epoch changes.

### Acceptance criteria
1. stale witness cannot authorize append after epoch advances,
2. witness must be bound to canonical scope and authority epoch,
3. replayed witness is rejected deterministically.

## Weakness 3 — Seal exit / re-entry can regress authority safety
### Failure mode
A runtime may leave sealed mode too easily after partial recovery, local restart, or transient connectivity, without proving that authority was truly re-established.

### Exploit path
- runtime loses witness and seals,
- process restarts or network recovers partially,
- runtime locally assumes authority is back and unseals,
- append service resumes before current authority is actually proven.

### Consequence
Refusal protects only the downtime moment, not recovery safety.

### Mitigation
- treat unseal as an explicit authority-reacquisition event,
- require fresh witness + current epoch/token-floor agreement before unsealing,
- persist sealed state across restart until authority is re-proven.

### Acceptance criteria
1. restart does not clear sealed state by default,
2. unseal requires fresh authority proof, not mere process liveness,
3. stale runtime cannot resume append service after restart without revalidation.

## Weakness 4 — Partial-scope refusal creates authority leaks
### Failure mode
If refusal is tracked too coarsely or too loosely, a runtime may correctly refuse one battle/run scope while still incorrectly serving adjacent or aliased scopes that share infrastructure.

### Exploit path
- authority lost for scope A,
- runtime seals A but still serves scope alias A' due to normalization mismatch,
- consumed history leaks across scopes or contradictory writes continue nearby.

### Consequence
The refusal contract looks scoped, but real scope boundaries are porous.

### Mitigation
- seal/refusal must use the same canonical scope key as append authority,
- any alias/normalization mismatch should fail closed,
- authority/refusal state transitions must be scoped identically to ledger writes.

### Acceptance criteria
1. canonical scope mismatch prevents append and unseal,
2. refusal state is keyed by the same canonical scope used by ledger records,
3. adjacent scope aliases cannot bypass refusal.

## Weakness 5 — Fail-open liveness pressure during partitions
### Failure mode
Under operational pressure, implementations often add “temporary degraded mode” so work can continue during witness outages or partial partitions.

### Exploit path
- witness unavailable,
- system flips to best-effort append mode for availability,
- stale runtime continues mutating authority history exactly when safety requires refusal.

### Consequence
The refusal-first contract collapses under the first real liveness tradeoff.

### Mitigation
- explicitly rank safety over liveness for authoritative append,
- degraded mode may allow reads/diagnostics, but not authoritative writes,
- make fail-open paths impossible in the append contract.

### Acceptance criteria
1. witness loss cannot degrade into best-effort append,
2. degraded mode (if any) is read-only / diagnostic-only,
3. authoritative append remains fail-closed under partition or witness outage.

## Bottom line
Refusal-first is the right direction, but only if refusal is a **real execution seal** rather than a polite local opinion. The cheapest failure modes are:
1. stale service paths still reachable after seal,
2. replayable/stale witness accepted as current authority,
3. unsafe unseal after restart or partial recovery,
4. scope leaks in refusal tracking,
5. fail-open liveness pressure during partitions.

## Recommended next build slice
Plan the smallest refusal contract with:
- explicit sealed state per canonical scope,
- fresh-witness requirement for unseal,
- sealed-state persistence across restart,
- append-boundary enforcement for all code paths,
- deterministic tests for stale witness, sealed restart, and no-fail-open append behavior.

## Explicit caveat
This critique narrows the remaining live-authority gap but does not prove real partition safety or consensus correctness. It identifies the cheapest ways a “refusal-first” design can still quietly keep serving stale authority.
