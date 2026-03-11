# 125 — Capability-Bound View Hardening Roadmap (2026-03-11)

## Trigger
Heartbeat Lane A (PLAN).

## Inputs
- Base plan: `docs/model/124-CAPABILITY-BOUND-OUTPUT-VIEWS-PLAN-2026-03-11.md`
- Red-team report: `docs/research/CAPABILITY-BOUND-OUTPUT-VIEWS-REDTEAM-2026-03-11.md`

## Goal
Turn the capability-bound output-view direction into a mergeable sequence of deterministic hardening slices that make view access policy explicit, ordered, and hard to probe.

## Failure classes to target
1. **Capability ambiguity** — adjacent capabilities/roles overlap or are interpreted inconsistently.
2. **Policy-shadowing** — evaluation order or broad rules silently override stricter context/risk restrictions.
3. **Denial-surface leakage** — downgrade/deny behavior teaches callers too much about the policy topology.

## Constrained tasks

### Task 1 — Explicit capability lattice + ordered policy evaluator
**Why first:** without a formal partial order and explicit precedence, every downgrade/deny decision is vulnerable to ambiguity and shadowing.

**Scope**
- deterministic evaluator in `packages/protocol`
- input: compact capability matrix / partial order, requested role, context/risk flags
- outputs:
  - `tactic-output-capability-allowed`
  - `tactic-output-capability-downgraded`
  - `tactic-output-capability-denied`
- policy evaluation order must be explicit:
  - blocked/risk/context restrictions
  - capability scope
  - role request
- artifact hash must be stable for identical inputs

**Acceptance criteria**
1. allowed role request yields `tactic-output-capability-allowed`
2. richer-than-allowed request yields deterministic `tactic-output-capability-downgraded`
3. unsupported request/context yields `tactic-output-capability-denied`
4. adjacent-capability confusion fixture is resolved by explicit lattice ordering
5. identical inputs produce identical artifact hash
6. `bun test` for the slice passes
7. `bunx tsc --noEmit -p packages/protocol` passes

### Task 2 — Context-bound capability guard
**Why second:** capabilities that ignore context drift into overly broad long-lived authority.

**Scope**
- bind capabilities to context/scope constraints
- reused capability outside intended context must fail or downgrade deterministically

**Acceptance criteria**
1. reused capability outside intended context is rejected or downgraded
2. identical inputs produce identical artifact hash
3. `bun test` for the slice passes
4. `bunx tsc --noEmit -p packages/protocol` passes

### Task 3 — Bounded downgrade/denial surface
**Why third:** callers should learn just enough to recover, not enough to map the role lattice.

**Scope**
- normalize downgrade/deny semantics
- minimize policy topology leakage through error/output structure

**Acceptance criteria**
1. downgrade/deny outputs reveal limited policy structure
2. probing fixture cannot infer richer-role topology from outcomes alone
3. identical inputs produce identical artifact hash
4. `bun test` for the slice passes
5. `bunx tsc --noEmit -p packages/protocol` passes

## Smallest mergeable milestone today
Implement **Task 1 only** in `packages/protocol` as a simulation/tooling slice. No runtime authz stack, no token issuance plumbing, no claim that policy-binding abuse is solved.

## Narrative-quality target
This roadmap succeeds only if capability decisions become more explicit and reviewable without turning downgrade/deny behavior into a policy oracle.

## Next Task
Lane B: implement Task 1 in `packages/protocol` (explicit capability lattice + ordered policy evaluator), no runtime wiring in the same slice.
