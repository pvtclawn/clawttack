# Red-Team — Suspicion-Triggered Monotonic Fencing Contract (2026-03-12 21:13 UTC)

## Trigger
Heartbeat Lane F (CHALLENGE).

## Scope
Red-team a suspicion-triggered monotonic fencing contract for false suspicion, stale lease, and lower-epoch replay failures in the freshness-authority path.

## Proposed target
- timeout / suspicion seals the scope,
- recovery requires a strictly newer epoch/term,
- lower or equal epoch attempts stay fenced,
- work admitted under old epochs remains invalid after epoch advance.

## Main question
Why might this still fail even if the monotonic epoch rule sounds clean?

## Weakness 1 — False suspicion can cause epoch inflation and recovery thrash
### Failure mode
If every timeout suspicion immediately forces a new epoch, transient latency spikes can ratchet epochs upward even though authority never truly changed.

### Exploit path
- brief pause / delayed witness refresh triggers suspicion,
- scope seals and demands newer epoch,
- repeated false suspicions keep bumping authority epochs,
- legitimate workers repeatedly lose continuity and re-establish authority.

### Consequence
Safety may remain intact, but the system becomes liveness-fragile and expensive to recover. Attackers can grief progress by causing harmless delays.

### Mitigation
- distinguish suspicion from confirmed authority transition,
- require explicit recovery evidence before epoch advancement is finalized,
- record suspicion cause separately from committed epoch change.

### Acceptance criteria
1. timeout suspicion alone does not silently rewrite authority history,
2. repeated false suspicions are visible and bounded,
3. epoch advancement is auditable rather than implicit.

## Weakness 2 — Lower-epoch fencing can still leak through stale admitted side channels
### Failure mode
A lower-epoch append may be rejected at the primary append boundary but still influence state through queued work, caches, or secondary execution paths that do not re-check epoch freshness.

### Exploit path
- append admitted at epoch `n`,
- recovery advances authority to `n+1`,
- stale work bypasses the main guard and still mutates state indirectly.

### Consequence
The fencing rule is correct on paper but incomplete in practice; stale authority still leaks via side channels.

### Mitigation
- require execution-time epoch re-check for every authoritative mutation path,
- propagate the admitted epoch alongside work items,
- quarantine or invalidate stale-epoch work uniformly.

### Acceptance criteria
1. all authoritative mutation paths validate current epoch at execution time,
2. queued stale work is denied deterministically,
3. no secondary path can mutate authority history without epoch validation.

## Weakness 3 — Stale lease / stale witness can look newer if epoch provenance is weak
### Failure mode
A witness carrying a larger number is not enough if the system cannot trust where that number came from. A bogus or stale witness may appear "newer" while not actually representing valid current authority.

### Exploit path
- stale runtime replays a witness object with incremented epoch,
- recovery logic checks only monotonicity, not provenance/binding,
- runtime unseals under a fake newer authority marker.

### Consequence
Epoch monotonicity becomes cosmetic; anyone who can fabricate a bigger number can bypass the safety boundary.

### Mitigation
- bind epoch evidence to canonical scope and trusted authority source,
- require provenance/consistency checks in addition to `epoch > previousEpoch`,
- reject untrusted or weakly bound newer-epoch evidence.

### Acceptance criteria
1. newer epoch without valid scope/provenance is rejected,
2. recovery requires both freshness and source/binding validity,
3. replayed synthetic epoch bumps cannot unseal a scope.

## Weakness 4 — Epoch monotonicity alone can erase contradiction context
### Failure mode
If recovery logic focuses only on finding a larger epoch, the system may forget *why* it sealed in the first place (conflicting evidence, scope mismatch, stale witness, etc.).

### Exploit path
- scope seals on conflicting authority evidence,
- a slightly newer epoch appears,
- system unseals immediately because the number is larger,
- unresolved contradiction is washed away by monotonicity.

### Consequence
A newer epoch can become a rug that sweeps unresolved evidence under it.

### Mitigation
- require recovery to satisfy the persisted uncertainty class, not just exceed the last epoch,
- treat monotonicity as necessary but not sufficient,
- preserve contradiction metadata through recovery decisions.

### Acceptance criteria
1. newer epoch alone cannot clear contradictory state unless the contradiction class is resolved,
2. persisted uncertainty class participates in recovery decisions,
3. monotonic fencing complements, rather than replaces, contradiction-aware recovery.

## Weakness 5 — Operational overrides can bypass fencing during outages
### Failure mode
When service pressure rises, teams may add emergency bypasses that ignore stale/lower epochs "temporarily" to restore progress.

### Exploit path
- outage or repeated suspicions hurt throughput,
- emergency path accepts locally plausible lower-epoch writes,
- stale authority regains the ability to mutate history.

### Consequence
The monotonic fencing contract is correct in the model but porous in production culture.

### Mitigation
- encode no-lower-epoch authoritative append as a hard contract,
- if overrides exist, keep them explicit, auditable, and non-authoritative,
- degraded mode may expose reads/diagnostics, never stale writes.

### Acceptance criteria
1. lower/equal epoch authoritative append has no implicit degraded fallback,
2. any override path is explicit and separately auditable,
3. degraded behavior cannot mutate consumed-digest authority history.

## Bottom line
Suspicion-triggered monotonic fencing is the right direction, but only if monotonicity is combined with:
1. bounded suspicion handling,
2. execution-time epoch enforcement across all authority paths,
3. trusted provenance for newer epochs,
4. contradiction-aware recovery,
5. no fail-open stale-authority override path.

## Recommended next build slice
Plan the smallest recovery contract that combines:
- explicit suspicion vs committed-epoch distinction,
- provenance-bound newer-epoch validation,
- contradiction-aware unseal rules,
- execution-time epoch re-check across append paths,
- deterministic tests for false suspicion thrash, fake-newer-epoch replay, and contradiction-preserving recovery.

## Explicit caveat
This critique narrows the monotonic-fencing design surface but does not prove live lease correctness, failure-detector correctness, or partition safety. It identifies the cheapest ways a seemingly strong epoch-fencing rule can still leak stale authority or collapse under operational stress.
