# 121 — Dual-Surface Contract Hardening Roadmap (2026-03-11)

## Trigger
Heartbeat Lane A (PLAN).

## Inputs
- Base plan: `docs/model/120-DUAL-SURFACE-OUTPUT-CONTRACT-PLAN-2026-03-11.md`
- Red-team report: `docs/research/DUAL-SURFACE-OUTPUT-CONTRACT-REDTEAM-2026-03-11.md`

## Goal
Turn the dual-surface output-contract direction into a mergeable sequence of deterministic hardening slices that keep the public surface minimal and stable without letting the contract boundary drift or bleed.

## Failure classes to target
1. **Contract drift** — public/audit surfaces evolve asymmetrically and visibility policy silently goes stale.
2. **Field bleed** — audit-only data escapes into the public contract through nested structures or serializer shortcuts.
3. **Boundary ambiguity** — public and audit artifacts become inconsistent or structurally informative in ways that leak hidden state.

## Constrained tasks

### Task 1 — Centralized contract compiler + identity linkage
**Why first:** if there is no single deterministic boundary generating both surfaces, every later field-bleed or drift guard becomes partial and brittle.

**Scope**
- deterministic evaluator in `packages/protocol`
- input: compact audit artifact + explicit visibility policy
- outputs:
  - `tactic-output-contract-public`
  - `tactic-output-contract-audit`
  - `tactic-output-contract-blocked`
- public and audit artifacts must be produced from one centralized translation boundary
- both artifacts must share stable linked identity proving common origin without leaking audit-only detail
- artifact hashes must be stable for identical inputs

**Acceptance criteria**
1. normal audit artifact yields a valid public contract with only allowlisted fields
2. audit contract preserves richer fields that are absent from the public contract
3. blocked case yields `tactic-output-contract-blocked`
4. public and audit artifacts share stable linkage identity for the same underlying case
5. identical inputs produce identical public and audit artifact hashes
6. `bun test` for the slice passes
7. `bunx tsc --noEmit -p packages/protocol` passes

### Task 2 — Field-bleed + drift guard
**Why second:** once the compiler exists, the next risk is stale policy and accidental nested-field bleed.

**Scope**
- explicit fixtures for nested audit-only bleed and new-field drift
- visibility policy must fail closed when new fields lack classification

**Acceptance criteria**
1. nested audit-only field bleed fixture fails
2. new-field drift fixture requires explicit visibility policy decision
3. identical inputs produce identical artifact hashes
4. `bun test` for the slice passes
5. `bunx tsc --noEmit -p packages/protocol` passes

### Task 3 — Shape-normalization guard
**Why third:** even correct field allowlists can still leak through public structure and divergence.

**Scope**
- stabilize field presence/order/nullability across the public contract
- detect public/audit divergence for the same underlying case

**Acceptance criteria**
1. structural inference fixture is reduced by stable field ordering/presence rules
2. public and audit divergence on the same case is detectable
3. identical inputs produce identical artifact hashes
4. `bun test` for the slice passes
5. `bunx tsc --noEmit -p packages/protocol` passes

## Smallest mergeable milestone today
Implement **Task 1 only** in `packages/protocol` as a simulation/tooling slice. No runtime presentation wiring, no multi-layer serializer refactor, no claim that contract-boundary leakage is solved.

## Narrative-quality target
This roadmap succeeds only if the public surface becomes a deliberate API contract instead of an accidental projection of the audit surface.

## Next Task
Lane B: implement Task 1 in `packages/protocol` (centralized contract compiler + identity linkage), no runtime wiring in the same slice.
