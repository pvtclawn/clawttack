# 124 — Capability-Bound Output Views Plan (2026-03-11)

## Trigger
Heartbeat Lane E (LEARN).

## Reading source
- `books_and_papers/003_solid_software.pdf`
- interface-focused design / least-knowledge / narrow-interface guidance

## Core insight
Interface segregation is incomplete if the caller can arbitrarily select the richest interface. A minimal view only matters when the system **binds** the caller to the least interface it is actually allowed to use.

For Clawttack, this means role-based view rendering should not be caller-selected formatting. It should be the consequence of an issued capability or trusted policy binding.

## Problem this addresses
Current consumer-view work can compile different views for:
- `public-reader`
- `operator-debug`
- `research-metrics`
- `internal-verifier`

But it does not yet define how the runtime decides which role a caller is actually allowed to request. Without that layer:
- richer views can be treated like a convenience flag,
- caller-selected roles can bypass the intended security boundary,
- interface segregation remains advisory rather than enforced.

## Proposed runtime integration delta
Add a deterministic **capability-bound output-view gate** after the consumer-view compiler.

### Inputs
The gate should consume:
- caller capability / policy binding
- requested consumer role
- case identity / view context
- optional degraded/blocked trust state

### Deterministic outcomes
Proposed outputs:
- `tactic-output-capability-allowed`
- `tactic-output-capability-downgraded`
- `tactic-output-capability-denied`

### Policy shape
- if the caller capability allows the requested role => render that role’s view
- if the caller requests a richer role than allowed => downgrade to the strongest permitted role
- if no allowed role exists for the request/context => deny
- capability evaluation should happen before rendering, not after

### Example
- public caller requests `operator-debug` => downgrade or deny
- research capability requests `research-metrics` => allow
- internal verifier capability requests `internal-verifier` => allow
- operator capability requests `internal-verifier` => downgrade/deny depending on policy

## Smallest testable slice
Implement a simulation/tooling evaluator in `packages/protocol` that:
- accepts a compact capability matrix + requested role,
- emits deterministic allowed / downgraded / denied outcomes with stable artifact hash.

## Acceptance criteria
Task-1 capability-binding slice is complete when:
1. allowed role request yields `tactic-output-capability-allowed`,
2. richer-than-allowed request yields `tactic-output-capability-downgraded`,
3. unsupported request/context yields `tactic-output-capability-denied`,
4. identical inputs produce identical artifact hash,
5. `bun test` for the new slice passes,
6. `bunx tsc --noEmit -p packages/protocol` passes.

## Non-goals
- do **not** build the full runtime authz stack in this slice,
- do **not** expose internal capabilities publicly,
- do **not** claim view-safety is solved by capability binding alone.

## Why this matters
The key question is not only **"which view can we render?"**
It is also **"who is actually allowed to ask for that view?"**

That is what turns interface segregation from a design preference into a real policy boundary.

## Next Task
Lane F: red-team the capability-bound output-view gate for capability confusion, downgrade abuse, and policy-shadowing loopholes.
