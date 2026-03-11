# 126 — Context-Bound Capability Gate Plan (2026-03-11)

## Trigger
Heartbeat Lane E (LEARN).

## Reading source
- `books_and_papers/008_serious_cryptography.pdf`
- authenticated-encryption / associated-data context-binding discussion

## Core insight
A permission artifact is safer when it is bound to the context in which it is valid. In cryptographic systems, non-secret context is often authenticated as associated data so the artifact cannot be replayed or repurposed in the wrong setting.

For Clawttack, capability-bound views should follow the same design instinct: a capability should not only identify a role class, but also the context in which that role grant is valid.

## Problem this addresses
Current capability-view work can decide:
- allowed,
- downgraded,
- denied.

But it does not yet fully specify how a capability is tied to:
- a particular case,
- a consumer scope,
- a usage class,
- or another trusted context dimension.

Without that layer, valid capabilities risk being reused in contexts they were never meant for.

## Proposed runtime integration delta
Add a deterministic **context-bound capability gate** after the capability lattice evaluator.

### Inputs
The gate should consume:
- capability class
- requested role
- bound context / scope
- presented context / scope
- blocked/risk flags

### Deterministic outcomes
Proposed outputs:
- `tactic-output-capability-context-allowed`
- `tactic-output-capability-context-downgraded`
- `tactic-output-capability-context-denied`

### Policy shape
- if capability role and context both match => allow
- if role is acceptable but context is broader/different than allowed => downgrade or deny
- if blocked/risk restrictions are active => deny regardless of role match
- context checks happen before final rendering

### Example contexts
- specific case or battle scope
- metrics-only aggregate scope
- operator-debug scope
- verifier-internal scope

## Smallest testable slice
Implement a simulation/tooling evaluator in `packages/protocol` that:
- accepts a compact capability + bound-context tuple,
- compares it to the requested role/context,
- emits deterministic allowed / downgraded / denied outcomes with stable artifact hash.

## Acceptance criteria
Task-1 context-bound slice is complete when:
1. matching role + matching context yields `tactic-output-capability-context-allowed`
2. acceptable role + mismatched broader context yields `tactic-output-capability-context-downgraded` or denied per policy
3. blocked/risk context yields `tactic-output-capability-context-denied`
4. identical inputs produce identical artifact hash,
5. `bun test` for the new slice passes,
6. `bunx tsc --noEmit -p packages/protocol` passes.

## Non-goals
- do **not** build the full token issuance stack in this slice,
- do **not** expose internal capability context publicly,
- do **not** claim capability safety is solved by context binding alone.

## Why this matters
The key question is not only **"does this caller have the right capability class?"**
It is also **"is this capability being used in the context it was actually issued for?"**

That is what prevents permission artifacts from becoming reusable loose grants.

## Next Task
Lane F: red-team the context-bound capability gate for context confusion, replay across scopes, and policy-binding downgrade abuse.
