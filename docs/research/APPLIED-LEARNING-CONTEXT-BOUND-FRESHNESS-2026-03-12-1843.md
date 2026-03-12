# Applied Learning — Context-Bound Capability Freshness + Transition Validity (2026-03-12 18:43 UTC)

## Trigger
Heartbeat Lane E (LEARN).

## Source
- `books_and_papers/007_building_agentic_ai.pdf`
- Relevant concepts extracted:
  - checkpointed graph/runtime state,
  - explicit thread-bound execution state,
  - state-transition validation as a gate before applying changes.

## Insight
The useful lesson is not “agents should remember more.” It is that **valid artifacts are only safe when interpreted against current runtime state**. In a checkpointed or graph-based agent workflow, a capability claim can be structurally valid yet still unsafe if it is replayed on the wrong thread/run, applied after the turn has advanced, or reused after the state transition it authorized has already been consumed.

## Concrete mechanism delta for Clawttack
Treat context-bound capability artifacts as **transition requests**, not free-standing permissions.

Before runtime execution, require a transition gate that validates:
1. **thread/run binding** — claim was issued for the current run/thread,
2. **turn binding** — claim turn matches the live turn index,
3. **freshness binding** — claim context version/hash still matches the current runtime state,
4. **single-use binding** — claim id/digest has not already been consumed,
5. **dependency validity** — any prerequisite authorization state still holds.

### Minimal payload extension
Add the following runtime-bound fields to the executable capability envelope:
- `battleId`
- `side`
- `runId` or `threadId`
- `turnIndex`
- `contextVersion` or `contextHash`
- `issuedAtStep` (monotonic epoch)
- `claimDigest`

## Why this is the right next integration slice
Task-1 proved typed scope normalization and deterministic artifact behavior. The next real risk is no longer semantic ambiguity alone; it is **stale-but-valid artifact reuse**. This delta directly targets replay-boundary and freshness failure classes without overclaiming full end-to-end runtime safety.

## Deterministic acceptance criteria
1. **Exact replay denied**
   - Given a claim already consumed once,
   - re-submitting the same `claimDigest` yields deterministic `duplicate/replayed` denial.
2. **Cross-run replay denied**
   - Given identical scope tuple + hash but different `runId/threadId`,
   - execution is denied as `wrong-runtime-binding`.
3. **Stale-turn denial**
   - Given a claim issued for turn `t`,
   - if runtime advances to `t+1`, the old claim is denied as `stale-turn`.
4. **Context-version mismatch denial**
   - Given runtime state changed after issuance,
   - mismatched `contextVersion/contextHash` is denied as `stale-context`.
5. **Happy-path single execution**
   - Given matching run, turn, context, and unconsumed digest,
   - execution succeeds once and persists consumed state so a second attempt fails deterministically.

## Explicit caveat
This is still a design/verification recommendation, not proof of deployed runtime safety. Full confidence still requires implementation, tests, and live wiring through the actual authorization path.

## Next Task
Lane F: red-team the proposed freshness/transition gate for gaming paths such as digest collision shaping, checkpoint rollback reuse, and delayed-delivery edge cases.
