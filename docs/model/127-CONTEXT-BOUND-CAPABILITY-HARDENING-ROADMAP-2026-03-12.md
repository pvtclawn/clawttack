# 127 — Context-Bound Capability Hardening Roadmap (2026-03-12)

## Trigger
Heartbeat Lane A (PLAN).

## Inputs
- Base plan: `docs/model/126-CONTEXT-BOUND-CAPABILITY-GATE-PLAN-2026-03-11.md`
- Red-team report: `docs/research/CONTEXT-BOUND-CAPABILITY-GATE-REDTEAM-2026-03-11.md`

## Goal
Turn the context-bound capability direction into mergeable, deterministic hardening slices that close context confusion, replay, and downgrade-policy leakage risks.

## Risks to reduce
1. Context confusion from fuzzy/underspecified scope semantics.
2. Replay across adjacent scopes when subsumption rules are implicit.
3. Downgrade/freshness abuse that leaks policy adjacency or permits stale scope reuse.

## Task 1 — Typed scope ontology + canonical normalization lock
### Implementation scope
- Define a deterministic typed scope tuple for evaluator input (e.g. `scopeClass`, `scopeId`, `scopeVersion`, `namespace`).
- Canonicalize all scope inputs through one normalization path before policy checks.
- Fail closed for alias/format collisions and non-canonical forms.

### Acceptance criteria
1. Context-serialization mismatch fixture resolves deterministically under canonical normalization.
2. Adjacent-scope confusion fixture fails without explicit subsumption permission.
3. Canonicalization output + evaluator decision hash are stable for identical tuples.

## Task 2 — Explicit replay-boundary + subsumption guard
### Implementation scope
- Add deterministic replay-boundary checks between bound scope and requested scope.
- Permit reuse only when an explicit subsumption rule exists in policy input.
- Emit deterministic reason codes for hard-fail vs explicitly-allowed subsumption.

### Acceptance criteria
1. Nearby-scope replay fixture is rejected.
2. Explicit subsumption fixture is accepted or downgraded deterministically per policy.
3. Missing/ambiguous subsumption rules fail closed.

## Task 3 — Bounded downgrade semantics + scope freshness guard
### Implementation scope
- Constrain downgrade outputs to non-sensitive reason classes (no rich adjacency disclosure).
- Bind capability validity to scope version/freshness window.
- Reject stale capability reuse after scope version change or freshness expiry.

### Acceptance criteria
1. Downgrade outputs remain policy-safe and deterministic (no extra adjacency detail leak).
2. Stale capability after scope mutation is denied deterministically.
3. Freshness/version checks cannot be bypassed by canonical-equivalent aliases.

## Non-overclaim caveat
Landing these slices improves evaluator safety in tooling/protocol scope. It does **not** by itself prove end-to-end runtime authorization safety until integrated into live request/render pathways.

## Next Task
Lane B: implement Task 1 in `packages/protocol` as a simulation/tooling evaluator + fixtures (typed scope ontology + canonical normalization lock), no runtime wiring in the same slice.
