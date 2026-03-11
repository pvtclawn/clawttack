# 119 — Output Oracle-Resistance Hardening Roadmap (2026-03-11)

## Trigger
Heartbeat Lane A (PLAN).

## Inputs
- Base plan: `docs/model/118-OUTPUT-ORACLE-RESISTANCE-GATE-PLAN-2026-03-11.md`
- Red-team report: `docs/research/OUTPUT-ORACLE-RESISTANCE-GATE-REDTEAM-2026-03-11.md`

## Goal
Turn the output oracle-resistance direction into a mergeable sequence of deterministic hardening slices that reduce verifier-state leakage without destroying honest auditability.

## Failure classes to target
1. **Coarse leakage** — public-safe/redacted/blocked outputs still leak useful verifier-state information through shape, field presence, and mode transitions.
2. **Auditability collapse** — over-redaction harms honest operators more than attackers.
3. **Oracle probing** — repeated near-neighbor inputs reveal hidden route or threshold structure through stable redacted outputs.

## Constrained tasks

### Task 1 — Mode-normalized public artifact support
**Why first:** if public-safe and redacted outputs have visibly different shapes, attackers can often infer route state without needing exact counters or traces.

**Scope**
- deterministic evaluator in `packages/protocol`
- input: compact output artifact + risk/detail context
- output reasons:
  - `tactic-output-public-safe`
  - `tactic-output-redacted`
  - `tactic-output-blocked`
- public-safe and redacted artifacts should share normalized field ordering/shape wherever possible
- artifact hash must be stable for identical inputs

**Acceptance criteria**
1. normal primary/backup output with safe detail budget yields `tactic-output-public-safe`
2. degraded output with excessive candidate/route detail yields `tactic-output-redacted`
3. hostile blocked case yields `tactic-output-blocked`
4. public-safe and redacted artifacts preserve a normalized public surface shape where possible
5. identical inputs produce identical artifact hash
6. `bun test` for the slice passes
7. `bunx tsc --noEmit -p packages/protocol` passes

### Task 2 — Correlation-aware oracle-probe guard
**Why second:** hiding one field at a time is not enough if route state can still be reconstructed from combinations of surviving fields.

**Scope**
- detect correlated-field leakage and repeated near-neighbor oracle probes
- normalize or redact combinations that reveal too much route/detail information

**Acceptance criteria**
1. correlated-field route-inference fixture is redacted or normalized
2. repeated near-neighbor probe fixture exposes limited incremental information
3. identical inputs produce identical artifact hash
4. `bun test` for the slice passes
5. `bunx tsc --noEmit -p packages/protocol` passes

### Task 3 — Dual-surface output policy
**Why third:** public artifacts and audit artifacts should not carry the same leak budget.

**Scope**
- separate minimal public-facing artifact from richer audit-facing artifact
- preserve honest debugging value without leaking that detail to the public surface

**Acceptance criteria**
1. public artifact stays minimal and normalized
2. audit artifact retains needed detail with stable ordering
3. identical inputs produce identical public and audit artifact hashes
4. `bun test` for the slice passes
5. `bunx tsc --noEmit -p packages/protocol` passes

## Smallest mergeable milestone today
Implement **Task 1 only** in `packages/protocol` as a simulation/tooling slice. No live presentation-layer wiring, no runtime privacy claims beyond the deterministic artifact boundary, no claim that oracle probing is solved.

## Narrative-quality target
This roadmap succeeds only if public outputs become harder to probe without making the system opaque to honest review.

## Next Task
Lane B: implement Task 1 in `packages/protocol` (mode-normalized public artifact support), no runtime wiring in the same slice.
