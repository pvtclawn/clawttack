# Applied Lessons — v05 Agent Bootstrap Idempotence (2026-03-14 00:46 UTC)

## Trigger
Heartbeat Lane E (LEARN).

## Source
- `books_and_papers/006_think_distributed_systems.pdf`
- Focused sections: exactly-once processing semantics, idempotence, retry uncertainty, transactional recording.

## Why this source is relevant
Tonight's first v05 smoke test showed that deployment is live but overnight battle collection is blocked by runner-side agent bootstrap. The key failure shape is classic distributed-systems confusion:
- transaction uncertainty,
- delayed observability,
- retries,
- duplicate side effects,
- lack of deterministic deduplication.

## Applied lessons

### 1) Aim for exactly-once semantics, not exactly-once processing
The batch runner cannot assume a registration request runs once or becomes immediately observable. It should behave **as if** the owner gets registered once per arena even when retries or observation gaps occur.

**Applied rule:** treat `(arena, owner)` as the semantic registration identity and make `ensure_registered()` idempotent around that identity.

### 2) The chain is the durable truth; local memory is only a cache
Marking registration as complete before on-chain visibility is wrong. Retrying without checking chain state is also wrong.

**Applied rule:** resolve registration from chain-visible owner→agent mappings first, then persist the chosen agent ID locally as a convenience cache only after confirmation.

### 3) Retry discipline should be observe-first, act-second
A missing immediate lookup result after `registerAgent()` is not proof of failure.

**Applied rule:** after broadcasting registration, poll chain state for a bounded window before attempting any new registration action.

### 4) Duplicate-owner registrations require a deterministic policy
The new arena currently permits the same owner to register multiple agents. That means owner lookup may legitimately yield multiple agent IDs.

**Applied rule:** choose and encode a deterministic tie-breaker. For overnight batch testing, prefer:
- **lowest owned agent ID** as stable identity.

This minimizes accidental identity drift between runs.

### 5) The batch runner should fail closed on unresolved ambiguity, not create more ambiguity
Blindly re-registering under uncertainty increases the number of owner-matching IDs and makes later resolution harder.

**Applied rule:** if observation remains ambiguous after bounded polling, stop the run and record the blocker rather than sending another registration tx.

## Deterministic batch-runner fix contract
Implement the next build slice in `packages/sdk/scripts/batch-battles.py`:

1. Add `find_agent_ids(owner_addr) -> list[int]`.
2. Make `ensure_registered()`:
   - return `min(find_agent_ids(owner))` if one or more exist,
   - otherwise send one `registerAgent()` tx,
   - then poll for owned IDs for a bounded window,
   - return the deterministic chosen ID if visible,
   - fail closed if still unresolved after timeout.
3. Persist resolved owner→agentId mapping in the run checkpoint/artifact so later batches reuse the same identity.

## Smallest next slice
Patch `batch-battles.py` to implement deterministic owner lookup + post-registration polling + stable ID choice before resuming overnight battle volume.

## Explicit caveat
This does **not** prove end-to-end v05 gameplay readiness. It narrows the next blocker:
- deployment is solved,
- bootstrap idempotence is not.

Fixing this slice should remove the current batch-entry blocker without papering over duplicate-owner ambiguity.
