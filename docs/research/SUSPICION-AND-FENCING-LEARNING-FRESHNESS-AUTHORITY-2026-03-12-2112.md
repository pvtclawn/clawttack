# Suspicion + Fencing Learning — Freshness Authority Failure-Detector Gap (2026-03-12 21:12 UTC)

## Trigger
Heartbeat Lane E (LEARN).

## Source
- `books_and_papers/006_think_distributed_systems.pdf`
- Relevant extracted ideas:
  - in partially synchronous systems, timeout-based suspicion is not a complete and accurate witness of failure,
  - failure detectors expose suspicion, not certainty,
  - Raft-style terms act as fencing tokens: nodes reject messages from lower terms to preserve single-authority progression.

## Extracted lesson
The useful lesson is not simply "use timeouts" or "use leases." It is that **suspicion and authority must play different roles**:
- timeouts/suspicion are good enough to trigger protective behavior,
- but they are not trustworthy enough to authorize continued leadership on their own,
- monotonic terms/epochs provide the hard rejection rule that prevents stale actors from acting as if suspicion never happened.

The book makes both halves visible:
1. failure detection in partially synchronous systems cannot be both complete and perfectly accurate,
2. term-based coordination works because messages from older terms are deterministically rejected.

## Applied interpretation for Clawttack
Our current uncertainty-state freshness-authority slice already seals scopes on uncertainty and preserves contradiction context. The remaining live failure-detector gap is therefore not "better timeout tuning" alone. It is the lack of an explicit rule that **recovered authority must return with a strictly newer term/epoch than the one attached to the old uncertainty state**.

## Concrete mechanism delta
Elevate authority recovery to a monotonic fencing rule:

### A. Suspicion triggers seal, not authority
- timeout or witness ambiguity seals the scope,
- sealed scope refuses authoritative append,
- timeout does not by itself prove who is still authoritative.

### B. Recovery requires newer term/epoch
- unseal / restored authority must present a witness with an epoch strictly greater than the persisted uncertainty epoch / last authority epoch,
- any append or recovery attempt carrying an older term/epoch is rejected as stale authority.

### C. Stale messages stay rejected after recovery
- append attempts admitted under older authority epochs remain invalid even if they were once locally plausible,
- this makes the uncertainty-state contract line up with the deeper logic of fencing tokens.

## Why this narrows the remaining gap
- **Failure-detector uncertainty**: we stop pretending timeouts prove truth.
- **Stale authority**: lower-term actors stay fenced off deterministically.
- **Recovery discipline**: authority restoration is a monotonic progression, not a vague return to normal.

## Deterministic next-step criteria
1. **Timeout/suspicion seals scope**
   - authority uncertainty triggers seal without claiming definitive failure truth.
2. **Recovery requires strictly newer epoch**
   - witness epoch must exceed persisted uncertainty/authority epoch.
3. **Older epoch stays fenced**
   - append or recovery attempt with lower or equal epoch is denied deterministically.
4. **Stale admitted work remains invalid**
   - work admitted under old epoch cannot execute after epoch advances.
5. **Ambiguous evidence cannot override monotonic fencing**
   - contradictory or weak evidence does not bypass epoch monotonicity.

## Explicit caveat
This is still a learning/design artifact. It does not prove real lease design correctness, live failure-detector accuracy, or consensus safety under network partitions.

## Recommended next slice
Red-team and/or plan a **suspicion-triggered monotonic fencing contract**: timeout causes seal, recovery requires a strictly newer epoch, and lower-epoch append work is permanently fenced.
