# State-Machine Safety Learning — Writer-Fenced Freshness Ledger Live Multi-Process Gap (2026-03-12 20:12 UTC)

## Trigger
Heartbeat Lane E (LEARN).

## Source
- `books_and_papers/006_think_distributed_systems.pdf`
- Relevant concepts extracted:
  - state machine safety,
  - leader + quorum composition,
  - quorum intersection preventing split-brain,
  - out-of-quorum nodes refraining from serving requests.

## Extracted lesson
The key lesson is that **"one leader" is not itself a safety guarantee**. State-machine safety comes from coordinated authority:
- an authoritative writer/leader is backed by an overlap property (quorum/shared witness), and
- nodes that cannot establish that authority must refrain from serving requests.

The text makes the anti-split-brain point directly: quorum intersection provides a shared witness so two incompatible authoritative histories cannot both proceed unnoticed. Just as important, nodes outside the quorum must stop responding to preserve safety.

## Applied interpretation for Clawttack
Our writer-fenced freshness ledger narrows the local append contract, but the remaining live multi-process gap is still visible:
- a stale or partitioned runtime may continue to believe it owns writer authority,
- a locally valid token is not enough if there is no strong shared witness of current authority,
- if stale runtimes continue answering append requests, contradictory authoritative history can still emerge.

## Concrete mechanism delta
The next useful hardening step should add a **refusal rule** on top of writer tokens:

### A. Authority is valid only with a current shared witness
A writer token/epoch should be treated as authoritative only when paired with a current shared authority witness for the scope.

### B. Stale / out-of-authority runtimes must refuse append service
If a runtime cannot prove it is within the current authority boundary for a scope, it must not append consumed state and must not present itself as authoritative.

This does not require implementing full distributed consensus in the next slice. But it does require making refusal explicit: local uncertainty should fail closed, not degrade into best-effort append optimism.

## Why this narrows the live multi-process gap
- **Split-brain**: overlap/shared witness makes contradictory authority harder to sustain.
- **Stale runtime risk**: refusal rule prevents fenced-off or partitioned nodes from continuing to mutate authority history.
- **Future end-to-end integration**: matches the book’s deeper point that safety is preserved not only by who may act, but by who must stop acting.

## Deterministic next-step criteria
1. **No-witness, no-append**
   - runtime without current authority witness fails closed.
2. **Fenced-off runtime refusal**
   - stale/fenced writer cannot continue append service after losing authority.
3. **Shared witness required for authority continuity**
   - authority changes must carry a monotonic shared witness / epoch boundary.
4. **Restart with stale authority cannot resume service**
   - recovered runtime with stale authority view must refuse append until authority is re-established.

## Explicit caveat
This is still a learning/design artifact. It does not prove distributed consensus, quorum implementation correctness, or live network-partition safety.

## Recommended next slice
Red-team and/or plan a **refusal-first authority contract**: when should a runtime seal itself, stop serving append requests, and require authority re-establishment before continuing.
