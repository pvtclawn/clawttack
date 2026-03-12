# Append-Only Log Learning — Freshness Ledger Power-Loss + Multi-Writer Caveats (2026-03-12 19:41 UTC)

## Trigger
Heartbeat Lane E (LEARN).

## Source
- `books_and_papers/006_think_distributed_systems.pdf`
- Relevant concepts extracted:
  - log-based recovery,
  - atomic commit as an irreversible logged decision boundary,
  - log replication / leader-based coordination,
  - state machine safety.

## Extracted lesson
The useful systems lesson is not merely “append to a durable log.” It is that **authoritative history requires both a commit boundary and a writer-coordination boundary**.

Two ideas from the text matter here:
1. **irreversible decision requires durable recording before the system behaves as committed**, and
2. **shared log safety depends on a coordination rule** (for example, leader/single-writer discipline) so the history means one coherent thing.

## Applied interpretation for Clawttack
Our file-backed freshness ledger narrowed one gap: restart-safe duplicate denial in a single-process simulation. But the two biggest remaining caveats map cleanly to the missing boundaries above:

### 1) Power-loss caveat = missing hard commit boundary
Even with `fsyncSync`, the current artifact does not yet prove that the consumed-digest record is durably committed under real filesystem/storage failure conditions. The deeper lesson is: a claim must not become externally “used” until the system has crossed a clearly defined durable commit boundary.

### 2) Multi-writer caveat = missing authority boundary
If multiple runtime instances can append consumed records for the same battle/run scope without coordination, the ledger can become logically inconsistent even if every individual append is well-formed. This is a log-authority problem, not merely a checksum problem.

## Concrete mechanism delta
The next useful hardening step should combine:

### A. Write-before-ack discipline
For any allow-path execution:
1. compute decision,
2. append + flush the consumed record,
3. only then surface successful single-use authorization.

### B. Single-writer fencing for ledger authority
Bind ledger append authority to a scope-specific owner token (battle/run writer epoch). A runtime instance may append consumed state only if it currently holds the valid writer token for that scope.

This does not require full distributed consensus in the next slice. It only requires an explicit local authority invariant instead of assuming “whoever is running may append.”

## Why this narrows the right remaining caveats
- **Power-loss**: forces a real commit boundary before success.
- **Multi-writer safety**: prevents split-brain append authority from invalidating replay history.
- **Future live-runtime integration**: lines up naturally with existing single-writer/fencing concepts already present elsewhere in the protocol work.

## Deterministic acceptance criteria for the next slice
1. **No-ack-before-durable-append**
   - if durable append fails, the execution cannot surface success.
2. **Writer-token required**
   - append attempt without valid writer token fails closed.
3. **Stale writer denied**
   - append attempt from stale/fenced-off writer fails deterministically.
4. **Same digest, wrong writer cannot mutate authority history**
   - unauthorized writer cannot add consumed records for a protected scope.
5. **Restart + valid writer still denies duplicate**
   - after recovery under a valid writer token, previously consumed digest remains denied.

## Explicit caveat
This is still a learning/design artifact. It does not prove distributed consensus, real disk flush semantics under hardware failure, or live executor atomicity.

## Recommended next slice
Red-team and/or plan a **writer-fenced ledger append contract** that combines durable append with scope-bound single-writer authority before attempting end-to-end runtime wiring.
