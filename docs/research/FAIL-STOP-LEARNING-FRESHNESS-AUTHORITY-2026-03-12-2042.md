# Fail-Stop Learning — Refusal-First Freshness Authority Under Live Partition Uncertainty (2026-03-12 20:42 UTC)

## Trigger
Heartbeat Lane E (LEARN).

## Source
- `books_and_papers/006_think_distributed_systems.pdf`
- Relevant extracted ideas:
  - when a node cannot participate in the quorum, it must refrain from responding to preserve safety,
  - in a partially synchronous system, timeout-based suspicion creates genuine uncertainty rather than certainty,
  - under uncertainty, exactly-once style confidence is impossible; the system must choose a safe behavior.

## Extracted lesson
The most useful lesson here is that **uncertainty is itself a safety signal**. When a node cannot establish that it remains within the current authority boundary, continuing to serve authoritative requests is unsafe.

The book makes this vivid in two complementary ways:
1. quorum-based systems preserve safety by requiring nodes outside the quorum to **refrain from responding**, and
2. timeout/failure suspicion in a partially synchronous system is not proof — it creates a state where the runtime truly does not know whether the world has moved on.

## Applied interpretation for Clawttack
Our refusal-first freshness-authority slice already introduced sealed state and fresh-witness unseal. The remaining live partition gap is therefore not just "better locking." It is a **fail-stop under authority uncertainty** rule:
- if authority witness is missing, stale, or ambiguous,
- the runtime should seal the scope,
- and authoritative append should stop until fresh authority is proven.

That is the correct live-runtime analogue of the simulation contract we now have.

## Concrete mechanism delta
Elevate authority uncertainty into an explicit runtime seal trigger.

### Trigger examples
- witness timeout,
- inability to refresh current authority witness,
- conflicting/stale authority epoch evidence,
- local recovery with no proof of current authority membership.

### Runtime rule
1. on authority uncertainty, seal scope immediately,
2. sealed scope refuses authoritative append,
3. restart preserves the sealed state,
4. only fresh authority proof for the same canonical scope may unseal.

## Why this narrows the remaining gap
- **Partition safety**: stale runtimes stop serving instead of improvising authority.
- **Split-brain pressure**: uncertain nodes fail-stop instead of contributing contradictory history.
- **Recovery discipline**: restart does not magically restore confidence; proof is required.

## Deterministic next-step criteria
1. **Authority timeout seals scope**
   - missing witness refresh triggers sealed state deterministically.
2. **No-proof, no-service**
   - sealed scope refuses authoritative append until fresh authority proof appears.
3. **Restart preserves uncertainty refusal**
   - runtime restart does not clear a seal caused by authority uncertainty.
4. **Fresh proof re-enables service**
   - matching fresh authority witness for the canonical scope is required to unseal.
5. **Ambiguous evidence fails safe**
   - conflicting/stale authority evidence cannot unseal or keep append service alive.

## Explicit caveat
This is still a learning/design artifact. It does not prove live quorum implementation correctness, real failure detector accuracy, or network-partition safety. It sharpens the safety posture to adopt when certainty is unavailable.

## Recommended next slice
Red-team and/or plan an **uncertainty-triggered seal contract** that treats authority ambiguity and witness timeout as immediate fail-stop conditions in the runtime path.
